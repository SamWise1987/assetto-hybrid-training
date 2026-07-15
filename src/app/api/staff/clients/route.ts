import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { requireStaff, staffClient } from "@/lib/supabase/profiles";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(80).optional(),
});

export async function GET(request: Request) {
  const staff = await requireStaff(request);
  if (!staff) return jsonError("Accesso trainer richiesto.", 403);
  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);

  let query = client.from("trainer_clients").select("*").neq("status", "archived").order("invited_at", { ascending: false });
  if (staff.role !== "admin") query = query.eq("trainer_user_id", staff.userId);
  const { data: relationships, error } = await query;
  if (error) return jsonError(error.message, 500);

  const userIds = (relationships ?? []).flatMap((item) => item.athlete_user_id ? [item.athlete_user_id] : []);
  const administrativeService = staff.role === "admin" ? createServiceSupabaseClient() : null;
  if (staff.role === "admin" && !administrativeService) return jsonError("Servizio amministrativo non configurato.", 503);
  const rolesResult = userIds.length
    ? await client.from("user_roles").select("user_id,email,display_name,role,created_at,updated_at").in("user_id", userIds)
    : { data: [], error: null };
  const profilesResult = userIds.length
    ? staff.role === "admin"
      ? await administrativeService!.from("athlete_profiles").select("user_id,display_name,primary_goal,onboarding_completed_at").in("user_id", userIds)
      : await client.from("athlete_profiles").select("*").in("user_id", userIds)
    : { data: [], error: null };
  const healthResult = userIds.length
    ? staff.role === "admin"
      ? await administrativeService!.from("health_sync_states").select("user_id,platform,status,last_successful_sync_at,updated_at").in("user_id", userIds)
      : await client.from("health_sync_states").select("*").in("user_id", userIds)
    : { data: [], error: null };
  const roles = rolesResult.data;
  const profiles = profilesResult.data;
  const healthStates = healthResult.data;

  return jsonOk({
    clients: (relationships ?? []).map((relationship) => ({
      ...relationship,
      account: roles?.find((role) => role.user_id === relationship.athlete_user_id) ?? null,
      profile: profiles?.find((profile) => profile.user_id === relationship.athlete_user_id) ?? null,
      health: healthStates?.find((state) => state.user_id === relationship.athlete_user_id) ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const staff = await requireStaff(request);
  if (!staff) return jsonError("Accesso trainer richiesto.", 403);
  const parsed = inviteSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Invito non valido.");
  const service = createServiceSupabaseClient();
  if (!service) return jsonError("Servizio amministrativo non configurato.", 503);

  const email = parsed.data.email.toLowerCase();
  const { data: existingRole } = await service.from("user_roles").select("user_id,email,display_name,role").eq("email", email).maybeSingle();
  if (existingRole && existingRole.role !== "athlete") {
    return jsonError("Questo indirizzo appartiene già a un account staff.", 409);
  }
  const { data: relationship, error: relationshipError } = await service.from("trainer_clients").upsert({
    trainer_user_id: staff.userId,
    athlete_user_id: existingRole?.user_id ?? null,
    athlete_email: email,
    status: existingRole ? "active" : "invited",
    invited_by: staff.userId,
    accepted_at: existingRole ? new Date().toISOString() : null,
  }, { onConflict: "trainer_user_id,athlete_email" }).select("*").single();
  if (relationshipError) return jsonError(relationshipError.message, 500);

  if (!existingRole) {
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/auth/callback?type=invite`;
    const { error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { display_name: parsed.data.displayName ?? email.split("@")[0], invited_by: staff.userId },
    });
    if (inviteError) return jsonError(inviteError.message, 400);
  }

  await service.from("audit_log").insert({ actor_user_id: staff.userId, action: "client_invited", entity_type: "trainer_client", entity_id: relationship.id, target_user_id: existingRole?.user_id ?? null, metadata: { email } });

  return jsonOk({ relationship, alreadyRegistered: Boolean(existingRole) });
}

export async function PATCH(request: Request) {
  const staff = await requireStaff(request);
  if (!staff || staff.role !== "admin") return jsonError("Solo l'amministratore può riassegnare i clienti.", 403);
  const parsed = z.object({ relationshipId: z.string().uuid(), trainerUserId: z.string().uuid() }).safeParse(await request.json());
  if (!parsed.success) return jsonError("Assegnazione non valida.");
  const service = createServiceSupabaseClient();
  if (!service) return jsonError("Servizio amministrativo non configurato.", 503);
  const { data: trainer } = await service.from("user_roles").select("role").eq("user_id", parsed.data.trainerUserId).maybeSingle();
  if (!trainer || trainer.role !== "coach") return jsonError("Trainer non valido.", 400);
  const { data, error } = await service.from("trainer_clients").update({ trainer_user_id: parsed.data.trainerUserId }).eq("id", parsed.data.relationshipId).select("*").single();
  if (error) return jsonError(error.message, 500);
  await service.from("audit_log").insert({ actor_user_id: staff.userId, action: "client_reassigned", entity_type: "trainer_client", entity_id: data.id, target_user_id: data.athlete_user_id, metadata: { trainerUserId: parsed.data.trainerUserId } });
  return jsonOk({ relationship: data });
}
