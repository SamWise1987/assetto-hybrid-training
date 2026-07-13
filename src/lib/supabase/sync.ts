import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./client";

export interface SyncPayload {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

export async function upsertSnapshot(
  client: SupabaseClient<Database>,
  input: { userId: string; deviceId: string; payload: SyncPayload },
) {
  const { error } = await client.from("sync_snapshots").upsert(
    {
      user_id: input.userId,
      device_id: input.deviceId,
      schema_version: input.payload.schemaVersion,
      payload: input.payload,
      exported_at: input.payload.exportedAt,
    },
    { onConflict: "user_id,device_id" },
  );

  if (error) throw new Error(error.message);
}

export async function fetchLatestSnapshot(
  client: SupabaseClient<Database>,
  userId: string,
  deviceId?: string,
) {
  let query = client
    .from("sync_snapshots")
    .select("payload, updated_at, device_id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (deviceId) query = query.eq("device_id", deviceId);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data?.payload as SyncPayload | null;
}

export async function recordSyncConsent(
  client: SupabaseClient<Database>,
  userId: string,
  deviceId: string,
) {
  const { error } = await client.from("sync_consents").upsert({
    user_id: userId,
    device_id: deviceId,
  });
  if (error) throw new Error(error.message);
}
