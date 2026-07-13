import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { getRemoteUserProfile } from "@/lib/supabase/profiles";

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri."),
  role: z.enum(["coach", "admin"]),
  displayName: z.string().min(1).max(80).optional(),
});

export async function GET(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile || profile.role !== "admin") {
    return jsonError("Solo gli amministratori possono visualizzare gli utenti.", 403);
  }

  const service = createServiceSupabaseClient();
  if (!service) return jsonError("Servizio non configurato.", 503);

  const { data, error } = await service
    .from("user_roles")
    .select("user_id, email, display_name, role, created_at")
    .order("email");

  if (error) return jsonError(error.message, 500);
  return jsonOk({ users: data ?? [] });
}

export async function POST(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile || profile.role !== "admin") {
    return jsonError("Solo gli amministratori possono creare account.", 403);
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dati non validi.";
    return jsonError(message, 400);
  }

  const service = createServiceSupabaseClient();
  if (!service) return jsonError("Servizio non configurato.", 503);

  const email = parsed.data.email.toLowerCase();
  const displayName = parsed.data.displayName ?? email.split("@")[0];

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (createError || !created.user) {
    return jsonError(createError?.message ?? "Creazione account fallita.", 400);
  }

  const { error: roleError } = await service.from("user_roles").upsert(
    {
      user_id: created.user.id,
      email,
      display_name: displayName,
      role: parsed.data.role,
    },
    { onConflict: "user_id" },
  );

  if (roleError) return jsonError(roleError.message, 500);

  return jsonOk({
    user: {
      userId: created.user.id,
      email,
      displayName,
      role: parsed.data.role,
    },
  });
}
