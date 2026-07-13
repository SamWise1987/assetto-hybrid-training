import { jsonError, jsonOk } from "@/lib/api-utils";
import { getRemoteUserProfile, mapRemotePlan, staffClient } from "@/lib/supabase/profiles";

export async function GET(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);

  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);

  const { data: assignment, error } = await client
    .from("plan_assignments")
    .select("id, plan_id, athlete_email, assigned_by, assigned_at, active")
    .eq("athlete_email", profile.email.toLowerCase())
    .eq("active", true)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!assignment) return jsonOk({ assignment: null, plan: null });

  const { data: planRow } = await client
    .from("training_plans")
    .select("*")
    .eq("id", assignment.plan_id)
    .single();

  return jsonOk({
    assignment: {
      id: assignment.id,
      planId: assignment.plan_id,
      athleteEmail: assignment.athlete_email,
      assignedBy: assignment.assigned_by,
      assignedAt: assignment.assigned_at,
      active: assignment.active,
    },
    plan: planRow ? mapRemotePlan(planRow) : null,
  });
}
