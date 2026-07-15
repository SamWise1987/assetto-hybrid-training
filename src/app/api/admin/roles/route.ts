import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { getRemoteUserProfile } from "@/lib/supabase/profiles";

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "coach", "athlete"]),
});

export async function POST(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile || profile.role !== "admin") {
    return jsonError("Solo gli admin possono gestire i ruoli.", 403);
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Ruolo non valido.");

  const service = createServiceSupabaseClient();
  if (!service) return jsonError("Supabase non configurato.", 503);

  const email = parsed.data.email.toLowerCase();
  const { data: current, error: currentError } = await service
    .from("user_roles")
    .select("user_id,email,role")
    .eq("email", email)
    .maybeSingle();

  if (currentError) return jsonError(currentError.message, 500);
  if (!current) return jsonError("Account non trovato.", 404);

  const { data: updated, error: updateError } = await service
    .from("user_roles")
    .update({ role: parsed.data.role })
    .eq("user_id", current.user_id)
    .select("user_id,email,role")
    .single();

  if (updateError || !updated) {
    return jsonError(updateError?.message ?? "Aggiornamento ruolo fallito.", 500);
  }

  await service.from("audit_log").insert({
    actor_user_id: profile.userId,
    action: "role_updated",
    entity_type: "user",
    entity_id: current.user_id,
    target_user_id: current.user_id,
    metadata: { previousRole: current.role, nextRole: updated.role, email: updated.email },
  });

  return jsonOk({ email: updated.email, role: updated.role });
}
