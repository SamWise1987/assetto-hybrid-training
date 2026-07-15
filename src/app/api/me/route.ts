import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { getRemoteUserProfile } from "@/lib/supabase/profiles";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  return jsonOk({ profile });
}

export async function PATCH(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);

  const body = z.object({ displayName: z.string().min(1).max(80), baseUpdatedAt: z.string().datetime().optional() }).safeParse(await request.json());
  if (!body.success) return jsonError("Nome non valido.");

  const client = createServiceSupabaseClient();
  if (!client) return jsonError("Servizio profilo non configurato.", 503);

  const { data: current, error: currentError } = await client.from("user_roles").select("updated_at").eq("user_id", profile.userId).single();
  if (currentError) return jsonError(currentError.message, 500);
  if (body.data.baseUpdatedAt && current.updated_at > body.data.baseUpdatedAt) {
    return jsonError("Il profilo è stato aggiornato da un altro dispositivo. Ricarica i dati prima di riprovare.", 409);
  }

  const { data: updated, error } = await client
    .from("user_roles")
    .update({ display_name: body.data.displayName })
    .eq("user_id", profile.userId)
    .select("updated_at")
    .single();

  if (error) return jsonError(error.message, 500);
  await client.from("athlete_profiles").update({ display_name: body.data.displayName }).eq("user_id", profile.userId);
  return jsonOk({ profile: { ...profile, displayName: body.data.displayName, updatedAt: updated.updated_at } });
}
