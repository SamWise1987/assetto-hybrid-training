import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { createUserSupabaseClient, getUserFromRequest } from "@/lib/supabase/server";
import { recordSyncConsent, upsertSnapshot, type SyncPayload } from "@/lib/supabase/sync";

const bodySchema = z.object({
  deviceId: z.string().min(8),
  payload: z.object({
    app: z.string(),
    schemaVersion: z.number(),
    exportedAt: z.string(),
    tables: z.record(z.string(), z.array(z.unknown())),
  }),
  consent: z.boolean().optional(),
});

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return jsonError("Autenticazione richiesta per la sincronizzazione.", 401);

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Payload sync non valido.");

  const client = createUserSupabaseClient(request.headers.get("authorization")!.slice(7));
  if (!client) return jsonError("Supabase non configurato sul server.", 503);

  const { deviceId, payload, consent } = parsed.data;

  if (consent) await recordSyncConsent(client, user.id, deviceId);
  await upsertSnapshot(client, {
    userId: user.id,
    deviceId,
    payload: payload as SyncPayload,
  });

  return jsonOk({ syncedAt: new Date().toISOString(), deviceId });
}
