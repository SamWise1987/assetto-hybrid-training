import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { getRemoteUserProfile } from "@/lib/supabase/profiles";

export async function GET(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  return jsonOk({ profile });
}

export async function PATCH(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);

  const body = z.object({ displayName: z.string().min(1).max(80) }).safeParse(await request.json());
  if (!body.success) return jsonError("Nome non valido.");

  const token = request.headers.get("authorization")!.slice(7);
  const { createUserSupabaseClient } = await import("@/lib/supabase/server");
  const client = createUserSupabaseClient(token);
  if (!client) return jsonError("Supabase non configurato.", 503);

  const { error } = await client
    .from("user_roles")
    .update({ display_name: body.data.displayName })
    .eq("user_id", profile.userId);

  if (error) return jsonError(error.message, 500);
  return jsonOk({ profile: { ...profile, displayName: body.data.displayName } });
}
