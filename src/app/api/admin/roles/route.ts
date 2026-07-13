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

  const { error } = await service
    .from("user_roles")
    .update({ role: parsed.data.role })
    .eq("email", parsed.data.email.toLowerCase());

  if (error) return jsonError(error.message, 500);
  return jsonOk({ email: parsed.data.email, role: parsed.data.role });
}
