import { backendStatus } from "@/lib/supabase/server";
import { jsonOk } from "@/lib/api-utils";

export async function GET() {
  return jsonOk({
    service: "roberta-functional-backend",
    status: "ok",
    ...backendStatus(),
    timestamp: new Date().toISOString(),
  });
}
