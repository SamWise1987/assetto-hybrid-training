import type { TrainingPlan, TrainingPlanSession, UserRole } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./client";
import { createServiceSupabaseClient, createUserSupabaseClient, getUserFromRequest } from "./server";
import { roleFromEmail } from "@/lib/roles";

export interface RemoteUserProfile {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  updatedAt: string;
}

export async function ensureUserProfile(user: { id: string; email?: string | null }) {
  const email = user.email?.toLowerCase();
  if (!email) return null;

  const service = createServiceSupabaseClient();
  if (!service) return null;

  const { data: existing } = await service
    .from("user_roles")
    .select("user_id, email, display_name, role, updated_at")
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
      .select("user_id, email, display_name, role, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return {
      userId: data.user_id,
      email: data.email,
      displayName: data.display_name,
      role: data.role as UserRole,
      updatedAt: data.updated_at,
    } satisfies RemoteUserProfile;
  }

  const nextDisplayName = existing.display_name || email.split("@")[0];
  const nextRole = existing.role === "athlete" && envRole === "admin" ? "admin" : existing.role;
  if (nextDisplayName === existing.display_name && nextRole === existing.role) {
    return {
      userId: existing.user_id,
      email: existing.email,
      displayName: existing.display_name,
      role: existing.role as UserRole,
      updatedAt: existing.updated_at,
    } satisfies RemoteUserProfile;
  }

  const { data, error } = await service
    .from("user_roles")
    .update({
      display_name: nextDisplayName,
      role: nextRole,
    })
    .eq("user_id", user.id)
    .select("user_id, email, display_name, role, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return {
    userId: data.user_id,
    email: data.email,
    displayName: data.display_name,
    role: data.role as UserRole,
    updatedAt: data.updated_at,
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
        workoutTemplateId: session.runConfig!.workoutTemplateId,
        segments: session.runConfig!.segments,
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

export async function verifyActiveTrainerClient(
  client: SupabaseClient<Database>,
  trainerUserId: string,
  athleteUserId: string,
) {
  const { data, error } = await client
    .from("trainer_clients")
    .select("id")
    .eq("trainer_user_id", trainerUserId)
    .eq("athlete_user_id", athleteUserId)
    .eq("status", "active")
    .maybeSingle();
  return { allowed: Boolean(data), error };
}
