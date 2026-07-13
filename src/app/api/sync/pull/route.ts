import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { createUserSupabaseClient, getUserFromRequest } from "@/lib/supabase/server";
import { fetchLatestSnapshot } from "@/lib/supabase/sync";

const querySchema = z.object({
  deviceId: z.string().optional(),
});

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return jsonError("Autenticazione richiesta per la sincronizzazione.", 401);

  const client = createUserSupabaseClient(request.headers.get("authorization")!.slice(7));
  if (!client) return jsonError("Supabase non configurato sul server.", 503);

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ deviceId: url.searchParams.get("deviceId") ?? undefined });
  if (!parsed.success) return jsonError("Parametri non validi.");

  const payload = await fetchLatestSnapshot(client, user.id, parsed.data.deviceId);
  if (!payload) return jsonOk({ payload: null });

  return jsonOk({ payload });
}
