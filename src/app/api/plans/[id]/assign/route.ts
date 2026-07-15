import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { mapRemotePlan, requireStaff, staffClient } from "@/lib/supabase/profiles";
import { dispatchPush } from "@/lib/push-server";
import { notificationDedupeKey } from "@/lib/notification-events";

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

  if (staff.role !== "admin") {
    const { data: relationship } = await client.from("trainer_clients").select("id").eq("trainer_user_id", staff.userId).eq("athlete_email", parsed.data.athleteEmail.toLowerCase()).in("status", ["invited", "active"]).maybeSingle();
    if (!relationship) return jsonError("Puoi assegnare piani soltanto ai tuoi clienti.", 403);
  }

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
    .select("id, plan_id, athlete_email, athlete_user_id, assigned_by, assigned_at, active")
    .single();

  if (error) return jsonError(error.message, 500);

  const { data: planRow } = await client.from("training_plans").select("*").eq("id", planId).single();

  if (data.athlete_user_id) {
    const { data: insertedNotification, error: notificationError } = await client.from("app_notifications").upsert({
      recipient_user_id: data.athlete_user_id,
      actor_user_id: staff.userId,
      type: "plan_assigned",
      title: "Nuovo piano disponibile",
      body: planRow?.name ? `Il trainer ti ha assegnato “${planRow.name}”.` : "Il trainer ti ha assegnato un nuovo programma.",
      href: "/?tab=today",
      entity_type: "training_plan",
      entity_id: planId,
      dedupe_key: notificationDedupeKey({ recipientUserId: data.athlete_user_id, type: "plan_assigned", entityId: planId, revision: data.id }),
    }, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("recipient_user_id").maybeSingle();
    if (notificationError) return jsonError(notificationError.message, 500);
    if (insertedNotification) await dispatchPush([data.athlete_user_id], { title: "Nuovo piano disponibile", body: "Il trainer ti ha assegnato un nuovo programma.", href: "/?tab=today" });
  }
  await client.from("audit_log").insert({ actor_user_id: staff.userId, action: "plan_assigned", entity_type: "plan_assignment", entity_id: data.id, target_user_id: data.athlete_user_id, metadata: { planId, athleteEmail: data.athlete_email } });

  return jsonOk({
    assignment: {
      id: data.id,
      planId: data.plan_id,
      athleteEmail: data.athlete_email,
      athleteUserId: data.athlete_user_id ?? undefined,
      assignedBy: data.assigned_by,
      assignedAt: data.assigned_at,
      active: data.active,
    },
    plan: planRow ? mapRemotePlan(planRow) : null,
  });
}
