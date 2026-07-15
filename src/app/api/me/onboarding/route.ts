import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { getRemoteUserProfile, staffClient } from "@/lib/supabase/profiles";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { ONBOARDING_CONSENT_VERSION } from "@/lib/consent";

const schema = z.object({
  displayName: z.string().min(1).max(80),
  primaryGoal: z.string().min(1).max(120),
  trainingDays: z.array(z.number().int().min(0).max(6)).max(7),
  equipment: z.array(z.string().min(1).max(80)).max(30),
  limitations: z.array(z.string().min(1).max(180)).max(30),
  healthSkipped: z.boolean(),
  consentAccepted: z.literal(true).optional(),
  consentVersion: z.literal(ONBOARDING_CONSENT_VERSION).optional(),
});

const consentSchema = z.object({
  consentAccepted: z.literal(true),
  consentVersion: z.literal(ONBOARDING_CONSENT_VERSION),
});

export async function GET(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  if (profile.role !== "athlete") return jsonError("Profilo atleta richiesto.", 403);
  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);
  const { data, error } = await client.from("athlete_profiles").select("*").eq("user_id", profile.userId).maybeSingle();
  if (error) return jsonError(error.message, 500);
  return jsonOk({ profile: data });
}

export async function PUT(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  if (profile.role !== "athlete") return jsonError("Profilo atleta richiesto.", 403);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Profilo onboarding non valido.");
  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);
  const service = createServiceSupabaseClient();
  if (!service) return jsonError("Supabase service role non configurato.", 503);
  const now = new Date().toISOString();
  const consent = parsed.data.consentAccepted && parsed.data.consentVersion
    ? { consent_accepted_at: now, consent_version: parsed.data.consentVersion }
    : {};
  const { error } = await client.from("athlete_profiles").upsert({
    user_id: profile.userId,
    display_name: parsed.data.displayName,
    primary_goal: parsed.data.primaryGoal,
    training_days: parsed.data.trainingDays,
    equipment: parsed.data.equipment,
    limitations: parsed.data.limitations,
    onboarding_completed_at: now,
    health_onboarding_skipped_at: parsed.data.healthSkipped ? now : null,
    ...consent,
  });
  if (error) return jsonError(error.message, 500);
  const { error: roleError } = await service.from("user_roles").update({ display_name: parsed.data.displayName }).eq("user_id", profile.userId);
  if (roleError) return jsonError(roleError.message, 500);
  return jsonOk({ completedAt: now, consentAcceptedAt: consent.consent_accepted_at ?? null, consentVersion: consent.consent_version ?? null });
}

export async function PATCH(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  if (profile.role !== "athlete") return jsonError("Profilo atleta richiesto.", 403);
  const parsed = consentSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Consenso non valido.");
  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);
  const acceptedAt = new Date().toISOString();
  const { data, error } = await client.from("athlete_profiles")
    .update({ consent_accepted_at: acceptedAt, consent_version: parsed.data.consentVersion })
    .eq("user_id", profile.userId)
    .not("onboarding_completed_at", "is", null)
    .select("consent_accepted_at, consent_version")
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Completa prima il profilo atleta.", 409);
  return jsonOk({ consentAcceptedAt: data.consent_accepted_at, consentVersion: data.consent_version });
}
