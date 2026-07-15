import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { getRemoteUserProfile, staffClient } from "@/lib/supabase/profiles";

export async function GET(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);
  const { data, error } = await client.from("app_notifications").select("*").eq("recipient_user_id", profile.userId).order("created_at", { ascending: false }).limit(100);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ notifications: data ?? [] });
}

export async function PATCH(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json());
  if (!parsed.success) return jsonError("Notifica non valida.");
  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);
  const { data, error } = await client.from("app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("recipient_user_id", profile.userId)
    .select("id")
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Notifica non trovata.", 404);
  return jsonOk({ read: true });
}
