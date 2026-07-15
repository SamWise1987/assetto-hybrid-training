import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { getRemoteUserProfile, staffClient } from "@/lib/supabase/profiles";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { dispatchPush } from "@/lib/push-server";
import { notificationDedupeKey } from "@/lib/notification-events";

const workoutSchema = z.object({
  id: z.string().uuid(),
  externalId: z.string().min(1).max(300),
  source: z.enum(["apple_health", "health_connect", "gpx", "strava"]),
  platform: z.enum(["web", "ios", "android"]),
  workoutType: z.string().min(1).max(120),
  kind: z.enum(["run", "walk", "strength", "other"]),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  durationMinutes: z.number().int().positive().max(1440),
  distanceKm: z.number().nonnegative().optional(),
  caloriesKcal: z.number().nonnegative().optional(),
  averageHeartRate: z.number().int().positive().optional(),
  maxHeartRate: z.number().int().positive().optional(),
  sourceName: z.string().max(180).optional(),
  matchedTemplateId: z.string().max(180).optional(),
  matchedAt: z.string().datetime().optional(),
  importedAt: z.string().datetime(),
});

export async function GET(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);
  const url = new URL(request.url);
  const requestedUserId = url.searchParams.get("userId");
  const userId = requestedUserId && profile.role !== "athlete" ? requestedUserId : profile.userId;
  const { data, error } = await client.from("external_workouts").select("*").eq("user_id", userId).order("start_date", { ascending: false }).limit(200);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ workouts: data ?? [] });
}

export async function POST(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  const parsed = z.object({ workouts: z.array(workoutSchema).max(250), healthState: z.object({ platform: z.enum(["ios", "android"]), status: z.enum(["success", "denied", "error"]), lastAttemptAt: z.string().datetime(), lastSuccessfulSyncAt: z.string().datetime().optional(), imported: z.number().int().nonnegative(), skipped: z.number().int().nonnegative(), errorMessage: z.string().max(500).optional() }).optional() }).safeParse(await request.json());
  if (!parsed.success) return jsonError("Attività non valide.");
  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);
  if (parsed.data.workouts.length) {
    const rows = parsed.data.workouts.map((item) => ({
      id: item.id, user_id: profile.userId, external_id: item.externalId, source: item.source,
      platform: item.platform, workout_type: item.workoutType, kind: item.kind,
      start_date: item.startDate, end_date: item.endDate, duration_minutes: item.durationMinutes,
      distance_km: item.distanceKm ?? null, calories_kcal: item.caloriesKcal ?? null,
      average_heart_rate: item.averageHeartRate ?? null, max_heart_rate: item.maxHeartRate ?? null,
      source_name: item.sourceName ?? null, matched_template_id: item.matchedTemplateId ?? null,
      matched_at: item.matchedAt ?? null, imported_at: item.importedAt,
    }));
    const { error } = await client.from("external_workouts").upsert(rows, { onConflict: "user_id,source,external_id" });
    if (error) return jsonError(error.message, 500);
  }
  if (parsed.data.healthState) {
    const state = parsed.data.healthState;
    const { error } = await client.from("health_sync_states").upsert({
      user_id: profile.userId, platform: state.platform, status: state.status,
      last_attempt_at: state.lastAttemptAt, last_successful_sync_at: state.lastSuccessfulSyncAt ?? null,
      last_imported_count: state.imported, last_skipped_count: state.skipped,
      error_message: state.errorMessage ?? null,
    }, { onConflict: "user_id,platform" });
    if (error) return jsonError(error.message, 500);
    if (state.status === "error" || state.status === "denied") {
      const service = createServiceSupabaseClient();
      if (!service) return jsonError("Servizio notifiche non configurato.", 503);
      const { data: relationships } = await service.from("trainer_clients").select("trainer_user_id").eq("athlete_user_id", profile.userId).eq("status", "active");
      const recipients = [...new Set((relationships ?? []).map((item) => item.trainer_user_id))];
      if (recipients.length) {
        const { data: insertedNotifications, error: notificationError } = await service.from("app_notifications").upsert(recipients.map((recipient) => ({
          recipient_user_id: recipient,
          actor_user_id: profile.userId,
          type: "health_issue",
          title: "Sincronizzazione Health da verificare",
          body: "Il collegamento del cliente richiede attenzione. Apri la dashboard per controllare lo stato.",
          href: "/?tab=clients",
          entity_type: "health_sync_state",
          entity_id: profile.userId,
          dedupe_key: notificationDedupeKey({ recipientUserId: recipient, type: "health_issue", entityId: profile.userId, revision: `${state.platform}-${state.status}-${state.lastAttemptAt.slice(0, 10)}` }),
        })), { onConflict: "dedupe_key", ignoreDuplicates: true }).select("recipient_user_id");
        if (notificationError) return jsonError(notificationError.message, 500);
        const pushRecipients = [...new Set((insertedNotifications ?? []).map((item) => item.recipient_user_id))];
        if (pushRecipients.length) await dispatchPush(pushRecipients, { title: "Sincronizzazione da verificare", body: "Un collegamento dispositivo richiede attenzione.", href: "/?tab=clients" });
      }
    }
  }
  return jsonOk({ synced: parsed.data.workouts.length });
}

export async function PATCH(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  const parsed = z.object({ id: z.string().uuid(), templateId: z.string().min(1).max(180) }).safeParse(await request.json());
  if (!parsed.success) return jsonError("Abbinamento non valido.");
  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);
  const { data, error } = await client.from("external_workouts")
    .update({ matched_template_id: parsed.data.templateId, matched_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("user_id", profile.userId)
    .select("id,matched_template_id,matched_at")
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Attività non trovata.", 404);
  return jsonOk({ matched: true, workout: data });
}
