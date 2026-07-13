import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { mapRemotePlan, requireStaff, staffClient } from "@/lib/supabase/profiles";

const assignSchema = z.object({
  athleteEmail: z.string().email(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff(request);
  if (!staff) return jsonError("Solo admin e coach possono assegnare piani.", 403);

  const { id: planId } = await context.params;
  const parsed = assignSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Email atleta non valida.");

  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);

  await client
    .from("plan_assignments")
    .update({ active: false })
    .eq("athlete_email", parsed.data.athleteEmail.toLowerCase())
    .eq("active", true);

  const { data, error } = await client
    .from("plan_assignments")
    .insert({
      plan_id: planId,
      athlete_email: parsed.data.athleteEmail.toLowerCase(),
      assigned_by: staff.userId,
      active: true,
    })
    .select("id, plan_id, athlete_email, assigned_by, assigned_at, active")
    .single();

  if (error) return jsonError(error.message, 500);

  const { data: planRow } = await client.from("training_plans").select("*").eq("id", planId).single();

  return jsonOk({
    assignment: {
      id: data.id,
      planId: data.plan_id,
      athleteEmail: data.athlete_email,
      assignedBy: data.assigned_by,
      assignedAt: data.assigned_at,
      active: data.active,
    },
    plan: planRow ? mapRemotePlan(planRow) : null,
  });
}
