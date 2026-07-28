import { backendStatus, probeSupabaseReachable } from "@/lib/supabase/server";
import { jsonOk } from "@/lib/api-utils";

export async function GET() {
  const configured = backendStatus();
  const supabaseReachable = configured.supabase ? await probeSupabaseReachable() : null;
  const healthy = !configured.supabase || supabaseReachable !== false;

  return jsonOk({
    service: "roberta-functional-backend",
    status: healthy ? "ok" : "degraded",
    ...configured,
    supabaseReachable,
    timestamp: new Date().toISOString(),
  });
}
