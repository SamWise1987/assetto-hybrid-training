import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { getRemoteUserProfile, staffClient, verifyActiveTrainerClient } from "@/lib/supabase/profiles";
import type { Database } from "@/lib/supabase/client";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { dispatchPush } from "@/lib/push-server";
import { notificationDedupeKey } from "@/lib/notification-events";

const itemSchema = z.object({
  entity: z.enum(["profile", "workout", "run", "external_workout", "readiness", "follow_up"]),
  entityId: z.string().min(1).max(220),
  payload: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  const parsed = z.object({ items: z.array(itemSchema).min(1).max(200) }).safeParse(await request.json());
  if (!parsed.success) return jsonError("Coda sincronizzazione non valida.");
  const client = staffClient(request); if (!client) return jsonError("Supabase non configurato.", 503);
  const completed: Array<{ type: "workout_completed" | "run_completed" | "follow_up" | "safety"; entityId: string }> = [];

  for (const item of parsed.data.items) {
    if (item.entity === "profile") {
      const payload = item.payload as Record<string, unknown>;
      const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() : "";
      if (!displayName || displayName.length > 80) return jsonError("Nome profilo non valido.");
      const service = createServiceSupabaseClient();
      if (!service) return jsonError("Servizio profilo non configurato.", 503);
      const { data: current, error: currentError } = await service.from("user_roles").select("updated_at").eq("user_id", profile.userId).single();
      if (currentError) return jsonError(currentError.message, 500);
      const baseUpdatedAt = typeof payload.baseUpdatedAt === "string" ? payload.baseUpdatedAt : undefined;
      if (baseUpdatedAt && current.updated_at > baseUpdatedAt) return jsonError("Il profilo è stato aggiornato da un altro dispositivo.", 409);
      const { error } = await service.from("user_roles").update({ display_name: displayName }).eq("user_id", profile.userId);
      if (error) return jsonError(error.message, 500);
      await service.from("athlete_profiles").update({ display_name: displayName }).eq("user_id", profile.userId);
    } else if (item.entity === "workout") {
      const payload = item.payload as Record<string, unknown>;
      const { data: inserted, error } = await client.from("training_session_logs").upsert({
        id: item.entityId, user_id: profile.userId, template_id: String(payload.templateId ?? "unknown"),
        session_date: String(payload.date ?? new Date().toISOString().slice(0, 10)), status: String(payload.status ?? "complete"),
        source: String(payload.source ?? "app"), payload: payload as Database["public"]["Tables"]["training_session_logs"]["Insert"]["payload"],
      }, { onConflict: "user_id,id", ignoreDuplicates: true }).select("id").maybeSingle();
      if (error) return jsonError(error.message, 500);
      if (inserted) completed.push({ type: payload.status === "stopped" ? "safety" : "workout_completed", entityId: item.entityId });
    } else if (item.entity === "run") {
      const payload = item.payload as Record<string, unknown>;
      const { data: inserted, error } = await client.from("run_session_logs").upsert({
        id: item.entityId, user_id: profile.userId, session_date: String(payload.date ?? new Date().toISOString().slice(0, 10)),
        status: String(payload.status ?? "complete"), source: String(payload.source ?? "app"),
        payload: payload as Database["public"]["Tables"]["run_session_logs"]["Insert"]["payload"],
      }, { onConflict: "user_id,id", ignoreDuplicates: true }).select("id").maybeSingle();
      if (error) return jsonError(error.message, 500);
      if (inserted) completed.push({ type: payload.status === "stopped" ? "safety" : "run_completed", entityId: item.entityId });
    } else if (item.entity === "readiness") {
      const payload = item.payload as Record<string, unknown>;
      const { data: inserted, error } = await client.from("readiness_logs").upsert({
        id: item.entityId, user_id: profile.userId, log_date: String(payload.date ?? new Date().toISOString().slice(0, 10)),
        payload: payload as Database["public"]["Tables"]["readiness_logs"]["Insert"]["payload"],
      }, { onConflict: "user_id,id", ignoreDuplicates: true }).select("id").maybeSingle();
      if (error) return jsonError(error.message, 500);
      if (inserted && (payload.armNeurologicalSymptoms === true || payload.coordinationWorsened === true)) completed.push({ type: "safety", entityId: item.entityId });
    } else if (item.entity === "follow_up") {
      const payload = item.payload as Record<string, unknown>;
      const { data: inserted, error } = await client.from("follow_up_logs").upsert({
        id: item.entityId, user_id: profile.userId, log_date: String(payload.date ?? new Date().toISOString().slice(0, 10)),
        session_id: String(payload.sessionId ?? "unknown"), payload: payload as Database["public"]["Tables"]["follow_up_logs"]["Insert"]["payload"],
      }, { onConflict: "user_id,id", ignoreDuplicates: true }).select("id").maybeSingle();
      if (error) return jsonError(error.message, 500);
      if (inserted) completed.push({ type: "follow_up", entityId: item.entityId });
    } else if (item.entity === "external_workout") {
      const payload = item.payload as Record<string, unknown>;
      const { error } = await client.from("external_workouts").upsert({
        id: item.entityId,
        user_id: profile.userId,
        external_id: String(payload.externalId ?? item.entityId),
        source: String(payload.source ?? "gpx"),
        platform: String(payload.platform ?? "web"),
        workout_type: String(payload.workoutType ?? "other"),
        kind: String(payload.kind ?? "other"),
        start_date: String(payload.startDate ?? new Date().toISOString()),
        end_date: String(payload.endDate ?? payload.startDate ?? new Date().toISOString()),
        duration_minutes: Number(payload.durationMinutes ?? 1),
        distance_km: typeof payload.distanceKm === "number" ? payload.distanceKm : null,
        calories_kcal: typeof payload.caloriesKcal === "number" ? payload.caloriesKcal : null,
        average_heart_rate: typeof payload.averageHeartRate === "number" ? payload.averageHeartRate : null,
        max_heart_rate: typeof payload.maxHeartRate === "number" ? payload.maxHeartRate : null,
        source_name: typeof payload.sourceName === "string" ? payload.sourceName : null,
        matched_template_id: typeof payload.matchedTemplateId === "string" ? payload.matchedTemplateId : null,
        matched_at: typeof payload.matchedAt === "string" ? payload.matchedAt : null,
        imported_at: String(payload.importedAt ?? new Date().toISOString()),
      }, { onConflict: "user_id,source,external_id" });
      if (error) return jsonError(error.message, 500);
    }
  }
  if (completed.length) {
    const { data: relationships } = await client
      .from("trainer_clients")
      .select("trainer_user_id")
      .eq("athlete_user_id", profile.userId)
      .eq("status", "active");
    const recipients = [...new Set((relationships ?? []).map((item) => item.trainer_user_id))];
    if (recipients.length) {
      const notificationClient = createServiceSupabaseClient();
      if (!notificationClient) return jsonError("Servizio notifiche non configurato.", 503);
      const { data: insertedNotifications, error: notificationError } = await notificationClient.from("app_notifications").upsert(recipients.flatMap((recipient) => completed.map((event) => ({
        recipient_user_id: recipient,
        actor_user_id: profile.userId,
        type: event.type,
        title: event.type === "safety" ? "Controllo trainer richiesto" : event.type === "run_completed" ? "Corsa completata" : event.type === "follow_up" ? "Risposta 24 ore ricevuta" : "Allenamento completato",
        body: event.type === "safety" ? "Una registrazione del cliente richiede una verifica. Apri la dashboard per i dettagli." : event.type === "follow_up" ? "Il cliente ha registrato il controllo di recupero." : "Il cliente ha registrato una nuova attività.",
        href: "/?tab=clients",
        entity_type: event.type === "run_completed" ? "run_session" : event.type === "follow_up" ? "follow_up" : event.type === "safety" ? "safety_event" : "training_session",
        entity_id: event.entityId,
        dedupe_key: notificationDedupeKey({ recipientUserId: recipient, type: event.type, entityId: event.entityId }),
      }))), { onConflict: "dedupe_key", ignoreDuplicates: true }).select("recipient_user_id");
      if (notificationError) return jsonError(notificationError.message, 500);
      const pushRecipients = [...new Set((insertedNotifications ?? []).map((item) => item.recipient_user_id))];
      const safety = completed.some((event) => event.type === "safety");
      if (pushRecipients.length) {
        await dispatchPush(pushRecipients, safety
          ? { title: "Controllo richiesto", body: "Una registrazione del cliente richiede una verifica.", href: "/?tab=clients" }
          : { title: "Nuova attività registrata", body: "Un cliente ha completato un allenamento.", href: "/?tab=clients" });
      }
    }
  }
  return jsonOk({ synced: parsed.data.items.length });
}

export async function GET(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  const requested = new URL(request.url).searchParams.get("userId");
  if (profile.role === "admin") return jsonError("I log dettagliati degli atleti non sono disponibili agli amministratori.", 403);
  if (profile.role === "athlete" && requested && requested !== profile.userId) return jsonError("Puoi consultare soltanto il tuo storico.", 403);
  const client = staffClient(request); if (!client) return jsonError("Supabase non configurato.", 503);
  let userId = profile.userId;
  if (profile.role === "coach") {
    const parsedAthleteId = z.string().uuid().safeParse(requested);
    if (!parsedAthleteId.success) return jsonError("Seleziona un cliente valido.");
    userId = parsedAthleteId.data;
    const access = await verifyActiveTrainerClient(client, profile.userId, userId);
    if (access.error) return jsonError(access.error.message, 500);
    if (!access.allowed) return jsonError("Cliente non assegnato a questo trainer.", 403);
  }
  const [{ data: workouts }, { data: runs }, { data: readiness }, { data: followUps }] = await Promise.all([
    client.from("training_session_logs").select("*").eq("user_id", userId).order("session_date", { ascending: false }).limit(200),
    client.from("run_session_logs").select("*").eq("user_id", userId).order("session_date", { ascending: false }).limit(200),
    client.from("readiness_logs").select("*").eq("user_id", userId).order("log_date", { ascending: false }).limit(200),
    client.from("follow_up_logs").select("*").eq("user_id", userId).order("log_date", { ascending: false }).limit(200),
  ]);
  return jsonOk({ workouts: workouts ?? [], runs: runs ?? [], readiness: readiness ?? [], followUps: followUps ?? [] });
}
