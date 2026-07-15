import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { getRemoteUserProfile, staffClient, verifyActiveTrainerClient } from "@/lib/supabase/profiles";
import type { Database } from "@/lib/supabase/client";
import { dispatchPush } from "@/lib/push-server";
import { applySuggestionToPlan, canTransitionSuggestion, suggestionPatchIsUnchanged } from "@/lib/analysis-suggestions";
import type { SuggestionStatus, TrainingPlanSession } from "@/lib/types";
import { notificationDedupeKey } from "@/lib/notification-events";

export async function GET(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  if (profile.role === "admin") return jsonError("I dettagli analitici degli atleti non sono disponibili agli amministratori.", 403);
  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);
  const requested = new URL(request.url).searchParams.get("userId");
  if (profile.role === "athlete" && requested && requested !== profile.userId) return jsonError("Puoi consultare soltanto la tua analisi.", 403);
  let athleteUserId = profile.userId;
  if (profile.role === "coach") {
    const parsedAthleteId = z.string().uuid().safeParse(requested);
    if (!parsedAthleteId.success) return jsonError("Seleziona un cliente valido.");
    athleteUserId = parsedAthleteId.data;
    const access = await verifyActiveTrainerClient(client, profile.userId, athleteUserId);
    if (access.error) return jsonError(access.error.message, 500);
    if (!access.allowed) return jsonError("Cliente non assegnato a questo trainer.", 403);
  }
  const { data, error } = await client.from("analysis_suggestions").select("*").eq("athlete_user_id", athleteUserId).order("created_at", { ascending: false });
  if (error) return jsonError(error.message, 500);
  return jsonOk({ suggestions: data ?? [] });
}

export async function POST(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile || profile.role !== "coach") return jsonError("Accesso trainer richiesto.", 403);
  const parsed = z.object({
    athleteUserId: z.string().uuid(), title: z.string().min(2).max(140), rationale: z.string().min(3).max(1000),
    evidence: z.array(z.string().max(300)).max(20).default([]), proposedChange: z.record(z.string(), z.unknown()).default({}),
  }).safeParse(await request.json());
  if (!parsed.success) return jsonError("Suggerimento non valido.");
  const client = staffClient(request); if (!client) return jsonError("Supabase non configurato.", 503);
  const access = await verifyActiveTrainerClient(client, profile.userId, parsed.data.athleteUserId);
  if (access.error) return jsonError(access.error.message, 500);
  if (!access.allowed) return jsonError("Cliente non assegnato a questo trainer.", 403);
  const { data, error } = await client.from("analysis_suggestions").insert({
    athlete_user_id: parsed.data.athleteUserId, title: parsed.data.title, rationale: parsed.data.rationale,
    evidence: parsed.data.evidence, proposed_change: parsed.data.proposedChange as Database["public"]["Tables"]["analysis_suggestions"]["Insert"]["proposed_change"], status: "proposed",
  }).select("*").single();
  if (error) return jsonError(error.message, 500);
  await client.from("audit_log").insert({ actor_user_id: profile.userId, action: "suggestion_proposed", entity_type: "analysis_suggestion", entity_id: data.id, target_user_id: data.athlete_user_id });
  return jsonOk({ suggestion: data });
}

export async function PATCH(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile || profile.role !== "coach") return jsonError("Accesso trainer richiesto.", 403);
  const parsed = z.object({
    id: z.string().uuid(),
    status: z.enum(["approved", "modified", "applied", "rejected", "undone"]),
    title: z.string().min(2).max(140).optional(),
    rationale: z.string().min(3).max(1000).optional(),
    proposedChange: z.record(z.string(), z.unknown()).optional(),
  }).safeParse(await request.json());
  if (!parsed.success) return jsonError("Revisione non valida.");
  const client = staffClient(request); if (!client) return jsonError("Supabase non configurato.", 503);
  const { data: currentSuggestion, error: suggestionError } = await client.from("analysis_suggestions").select("*").eq("id", parsed.data.id).single();
  if (suggestionError || !currentSuggestion) return jsonError(suggestionError?.message ?? "Suggerimento non trovato.", 404);
  const hasContentEdits = parsed.data.title !== undefined
    || parsed.data.rationale !== undefined
    || parsed.data.proposedChange !== undefined;
  if (suggestionPatchIsUnchanged(currentSuggestion.status as SuggestionStatus, parsed.data.status, hasContentEdits)) {
    return jsonOk({ suggestion: currentSuggestion, unchanged: true });
  }
  if (!canTransitionSuggestion(currentSuggestion.status as SuggestionStatus, parsed.data.status)) return jsonError(`Transizione ${currentSuggestion.status} → ${parsed.data.status} non consentita.`, 409);

  const proposedChange = parsed.data.proposedChange ?? (currentSuggestion.proposed_change as Record<string, unknown>);
  if (parsed.data.status === "modified" && !parsed.data.proposedChange) return jsonError("Inserisci la modifica proposta.");

  if (["approved", "applied", "undone"].includes(parsed.data.status)) {
    const { data: assignment } = await client.from("plan_assignments").select("plan_id").eq("athlete_user_id", currentSuggestion.athlete_user_id).eq("active", true).order("assigned_at", { ascending: false }).limit(1).maybeSingle();
    if (!assignment?.plan_id) return jsonError("Il cliente non ha un piano attivo.", 409);
    const { data: currentPlan, error: planError } = await client.from("training_plans").select("*").eq("id", assignment.plan_id).single();
    if (planError || !currentPlan) return jsonError(planError?.message ?? "Piano non trovato.", 409);
    const { data: versions } = await client.from("plan_versions").select("version,snapshot").eq("plan_id", assignment.plan_id).order("version", { ascending: false }).limit(2);
    let versionSnapshot: Record<string, unknown> = currentPlan as unknown as Record<string, unknown>;

    if (parsed.data.status === "applied") {
      const changed = applySuggestionToPlan({
        name: currentPlan.name,
        description: currentPlan.description,
        sessions: currentPlan.sessions as unknown as TrainingPlanSession[],
      }, proposedChange);
      const { data: appliedPlan, error: applyError } = await client.from("training_plans").update({
        name: changed.name,
        description: changed.description,
        sessions: changed.sessions as unknown as Database["public"]["Tables"]["training_plans"]["Update"]["sessions"],
      }).eq("id", assignment.plan_id).select("*").single();
      if (applyError || !appliedPlan) return jsonError(applyError?.message ?? "Applicazione non riuscita.", 500);
      versionSnapshot = appliedPlan as unknown as Record<string, unknown>;
    } else if (parsed.data.status === "undone") {
      const previous = versions?.[1]?.snapshot;
      if (!previous || typeof previous !== "object" || Array.isArray(previous)) return jsonError("Versione precedente non disponibile.", 409);
      const snapshot = previous as Record<string, unknown>;
      if (typeof snapshot.name !== "string" || !Array.isArray(snapshot.sessions)) return jsonError("Snapshot precedente non valido.", 409);
      const { data: restored, error: restoreError } = await client.from("training_plans").update({
        name: snapshot.name,
        description: typeof snapshot.description === "string" ? snapshot.description : null,
        sessions: snapshot.sessions as Database["public"]["Tables"]["training_plans"]["Update"]["sessions"],
      }).eq("id", assignment.plan_id).select("*").single();
      if (restoreError || !restored) return jsonError(restoreError?.message ?? "Ripristino non riuscito.", 500);
      versionSnapshot = restored as unknown as Record<string, unknown>;
    }

    const nextVersion = (versions?.[0]?.version ?? 0) + 1;
    const { error: versionError } = await client.from("plan_versions").insert({
      plan_id: assignment.plan_id,
      version: nextVersion,
      snapshot: versionSnapshot as Database["public"]["Tables"]["plan_versions"]["Insert"]["snapshot"],
      reason: `${parsed.data.status === "applied" ? "Applicazione" : parsed.data.status === "undone" ? "Annullamento" : "Approvazione"} suggerimento: ${currentSuggestion.title}`,
      created_by: profile.userId,
    });
    if (versionError) return jsonError(versionError.message, 500);
  }

  const update: Database["public"]["Tables"]["analysis_suggestions"]["Update"] = {
    status: parsed.data.status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: profile.userId,
    ...(parsed.data.title ? { title: parsed.data.title } : {}),
    ...(parsed.data.rationale ? { rationale: parsed.data.rationale } : {}),
    ...(parsed.data.proposedChange ? { proposed_change: proposedChange as Database["public"]["Tables"]["analysis_suggestions"]["Insert"]["proposed_change"] } : {}),
  };
  const { data, error } = await client.from("analysis_suggestions").update(update).eq("id", parsed.data.id).select("*").single();
  if (error) return jsonError(error.message, 500);
  const { data: insertedNotification, error: notificationError } = await client.from("app_notifications").upsert({
    recipient_user_id: data.athlete_user_id, actor_user_id: profile.userId, type: "suggestion",
    title: parsed.data.status === "rejected" ? "Suggerimento archiviato" : parsed.data.status === "undone" ? "Modifica annullata" : "Aggiornamento dell’analisi",
    body: parsed.data.status === "applied" ? `Il trainer ha applicato: ${data.title}` : parsed.data.status === "undone" ? `Il trainer ha annullato: ${data.title}` : `Il trainer ha aggiornato: ${data.title}`,
    href: "/?tab=analysis", entity_type: "analysis_suggestion", entity_id: data.id,
    dedupe_key: notificationDedupeKey({ recipientUserId: data.athlete_user_id, type: "suggestion", entityId: data.id, revision: parsed.data.status }),
  }, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("recipient_user_id").maybeSingle();
  if (notificationError) return jsonError(notificationError.message, 500);
  if (insertedNotification) await dispatchPush([data.athlete_user_id], { title: parsed.data.status === "rejected" ? "Suggerimento archiviato" : "Aggiornamento dell'analisi", body: "Il trainer ha aggiornato una proposta nel tuo piano.", href: "/?tab=analysis" });
  await client.from("audit_log").insert({ actor_user_id: profile.userId, action: `suggestion_${parsed.data.status}`, entity_type: "analysis_suggestion", entity_id: data.id, target_user_id: data.athlete_user_id });
  return jsonOk({ suggestion: data });
}
