import type { TrainingPlan, TrainingPlanSession, UserRole } from "@/lib/types";
import { createServiceSupabaseClient, createUserSupabaseClient, getUserFromRequest } from "./server";
import { roleFromEmail } from "@/lib/roles";

export interface RemoteUserProfile {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export async function ensureUserProfile(user: { id: string; email?: string | null }) {
  const email = user.email?.toLowerCase();
  if (!email) return null;

  const service = createServiceSupabaseClient();
  if (!service) return null;

  const { data: existing } = await service
    .from("user_roles")
    .select("user_id, email, display_name, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const envRole = roleFromEmail(email);
  const role: UserRole = existing?.role === "admin" || existing?.role === "coach"
    ? existing.role
    : envRole;

  if (!existing) {
    const { data, error } = await service
      .from("user_roles")
      .insert({
        user_id: user.id,
        email,
        display_name: email.split("@")[0],
        role,
      })
      .select("user_id, email, display_name, role")
      .single();
    if (error) throw new Error(error.message);
    return {
      userId: data.user_id,
      email: data.email,
      displayName: data.display_name,
      role: data.role as UserRole,
    } satisfies RemoteUserProfile;
  }

  const { data, error } = await service
    .from("user_roles")
    .update({
      display_name: existing.display_name || email.split("@")[0],
      role: existing.role === "athlete" && envRole === "admin" ? "admin" : existing.role,
    })
    .eq("user_id", user.id)
    .select("user_id, email, display_name, role")
    .single();

  if (error) throw new Error(error.message);
  return {
    userId: data.user_id,
    email: data.email,
    displayName: data.display_name,
    role: data.role as UserRole,
  } satisfies RemoteUserProfile;
}

export async function getRemoteUserProfile(request: Request): Promise<RemoteUserProfile | null> {
  const user = await getUserFromRequest(request);
  if (!user?.email) return null;
  return ensureUserProfile(user);
}

export async function requireStaff(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile || (profile.role !== "admin" && profile.role !== "coach")) {
    return null;
  }
  return profile;
}

export function mapRemotePlan(row: {
  id: string;
  name: string;
  description: string | null;
  sessions: TrainingPlanSession[] | unknown;
  created_by: string;
  created_at: string;
  updated_at: string;
}): TrainingPlan {
  const sessions = row.sessions as TrainingPlanSession[];
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    sessions,
    runSessions: sessions
      .filter((session) => session.runConfig)
      .map((session) => ({
        dayOfWeek: session.dayOfWeek,
        type: session.runConfig!.type,
        durationMinutes: session.runConfig!.durationMinutes,
        notes: session.runConfig!.notes,
      })),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function staffClient(request: Request) {
  const token = request.headers.get("authorization")?.slice(7);
  if (!token) return null;
  return createUserSupabaseClient(token);
}
