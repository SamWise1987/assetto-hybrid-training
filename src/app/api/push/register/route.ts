import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { getRemoteUserProfile, staffClient } from "@/lib/supabase/profiles";

const schema = z.object({
  platform: z.enum(["web", "ios", "android"]),
  deviceId: z.string().min(3).max(200),
  endpoint: z.string().url().optional(),
  nativeToken: z.string().min(8).max(4096).optional(),
  p256dh: z.string().optional(),
  auth: z.string().optional(),
});

export async function GET(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  const client = staffClient(request); if (!client) return jsonError("Supabase non configurato.", 503);
  const { data, error } = await client.from("push_subscriptions").select("id,platform,device_id,updated_at").eq("user_id", profile.userId);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ subscriptions: data ?? [], webPushConfigured: Boolean(process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY) });
}

export async function POST(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Registrazione push non valida.");
  if (parsed.data.platform === "web" && (!parsed.data.endpoint || !parsed.data.p256dh || !parsed.data.auth)) return jsonError("Subscription Web Push incompleta.");
  if (parsed.data.platform !== "web" && !parsed.data.nativeToken) return jsonError("Token push nativo mancante.");
  const client = staffClient(request); if (!client) return jsonError("Supabase non configurato.", 503);
  const { error } = await client.from("push_subscriptions").upsert({
    user_id: profile.userId, platform: parsed.data.platform, device_id: parsed.data.deviceId,
    endpoint: parsed.data.endpoint ?? null, native_token: parsed.data.nativeToken ?? null,
    p256dh: parsed.data.p256dh ?? null, auth: parsed.data.auth ?? null,
  }, { onConflict: "user_id,platform,device_id" });
  if (error) return jsonError(error.message, 500);
  return jsonOk({ registered: true });
}

export async function DELETE(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  const parsed = z.object({ platform: z.enum(["web", "ios", "android"]), deviceId: z.string().min(3).max(200) }).safeParse(await request.json());
  if (!parsed.success) return jsonError("Rimozione non valida.");
  const client = staffClient(request); if (!client) return jsonError("Supabase non configurato.", 503);
  const { error } = await client.from("push_subscriptions").delete().eq("user_id", profile.userId).eq("platform", parsed.data.platform).eq("device_id", parsed.data.deviceId);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ removed: true });
}
