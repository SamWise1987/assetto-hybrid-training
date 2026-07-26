import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { getRemoteUserProfile, staffClient, verifyActiveTrainerClient } from "@/lib/supabase/profiles";

const metricSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    "restingHeartRate",
    "heartRateVariability",
    "respiratoryRate",
    "oxygenSaturation",
    "steps",
    "sleepMinutes",
  ]),
  value: z.number().positive(),
  unit: z.string().min(1).max(40),
  recordedAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  source: z.enum(["apple_health", "health_connect"]),
  platform: z.enum(["web", "ios", "android"]),
  externalId: z.string().min(1).max(300),
  platformId: z.string().max(300).optional(),
  sourceName: z.string().max(180).optional(),
  importedAt: z.string().datetime(),
});

export async function GET(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  const url = new URL(request.url);
  const requestedUserId = url.searchParams.get("userId");
  if (profile.role === "admin") return jsonError("I dettagli Health non sono disponibili agli amministratori.", 403);
  if (profile.role === "athlete" && requestedUserId && requestedUserId !== profile.userId) {
    return jsonError("Puoi consultare soltanto i tuoi segnali salute.", 403);
  }

  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);

  let userId = profile.userId;
  if (profile.role === "coach") {
    const parsedAthleteId = z.string().uuid().safeParse(requestedUserId);
    if (!parsedAthleteId.success) return jsonError("Seleziona un cliente valido.");
    userId = parsedAthleteId.data;
    const access = await verifyActiveTrainerClient(client, profile.userId, userId);
    if (access.error) return jsonError(access.error.message, 500);
    if (!access.allowed) return jsonError("Cliente non assegnato a questo trainer.", 403);
  }

  const { data, error } = await client
    .from("health_metric_samples")
    .select("*")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(400);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ metrics: data ?? [] });
}

export async function POST(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);

  const parsed = z.object({ metrics: z.array(metricSchema).max(400) }).safeParse(await request.json());
  if (!parsed.success) return jsonError("Metriche salute non valide.");
  if (!parsed.data.metrics.length) return jsonOk({ synced: 0 });

  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);

  const rows = parsed.data.metrics.map((item) => ({
    id: item.id,
    user_id: profile.userId,
    metric_type: item.type,
    value: item.value,
    unit: item.unit,
    recorded_at: item.recordedAt,
    end_at: item.endAt ?? null,
    source: item.source,
    platform: item.platform,
    external_id: item.externalId,
    platform_id: item.platformId ?? null,
    source_name: item.sourceName ?? null,
    imported_at: item.importedAt,
  }));

  const { error } = await client
    .from("health_metric_samples")
    .upsert(rows, { onConflict: "user_id,source,external_id" });
  if (error) return jsonError(error.message, 500);

  return jsonOk({ synced: rows.length });
}
