import { jsonError, jsonOk } from "@/lib/api-utils";
import { getRemoteUserProfile, staffClient } from "@/lib/supabase/profiles";

export async function GET(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile || profile.role !== "admin") return jsonError("Accesso amministratore richiesto.", 403);
  const client = staffClient(request); if (!client) return jsonError("Supabase non configurato.", 503);
  const { data, error } = await client.from("app_error_events").select("id,subsystem,severity,message,platform,created_at").order("created_at", { ascending: false }).limit(100);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ events: data ?? [] });
}
