import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/client";

type MatchValidation =
  | { allowed: true }
  | { allowed: false; reason: "no_active_plan" | "invalid_template"; error?: string };

export function hasStrengthTemplate(sessions: unknown, templateId: string) {
  if (!Array.isArray(sessions)) return false;
  return sessions.some((session) => {
    if (!session || typeof session !== "object") return false;
    const candidate = session as Record<string, unknown>;
    return candidate.templateId === templateId && candidate.kind === "strength";
  });
}

export async function verifyActiveStrengthTemplate(
  client: SupabaseClient<Database>,
  athleteEmail: string,
  templateId: string,
): Promise<MatchValidation> {
  const { data: assignment, error: assignmentError } = await client
    .from("plan_assignments")
    .select("plan_id")
    .eq("athlete_email", athleteEmail.toLowerCase())
    .eq("active", true)
    .maybeSingle();

  if (assignmentError) return { allowed: false, reason: "no_active_plan", error: assignmentError.message };
  if (!assignment?.plan_id) return { allowed: false, reason: "no_active_plan" };

  const { data: plan, error: planError } = await client
    .from("training_plans")
    .select("sessions")
    .eq("id", assignment.plan_id)
    .maybeSingle();

  if (planError) return { allowed: false, reason: "invalid_template", error: planError.message };
  return hasStrengthTemplate(plan?.sessions, templateId)
    ? { allowed: true }
    : { allowed: false, reason: "invalid_template" };
}
