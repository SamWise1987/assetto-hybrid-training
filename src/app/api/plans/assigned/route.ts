import { jsonError, jsonOk } from "@/lib/api-utils";
import { getRemoteUserProfile, mapRemotePlan, staffClient } from "@/lib/supabase/profiles";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { dispatchPush } from "@/lib/push-server";
import { notificationDedupeKey } from "@/lib/notification-events";

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

  if (planRow) {
    const service = createServiceSupabaseClient();
    if (service) {
      const title = "Nuovo piano disponibile";
      const body = `Il trainer ti ha assegnato “${planRow.name}”.`;
      const { data: insertedNotification } = await service.from("app_notifications").upsert({
        recipient_user_id: profile.userId,
        actor_user_id: assignment.assigned_by,
        type: "plan_assigned",
        title,
        body,
        href: "/?tab=today",
        entity_type: "training_plan",
        entity_id: assignment.plan_id,
        dedupe_key: notificationDedupeKey({
          recipientUserId: profile.userId,
          type: "plan_assigned",
          entityId: assignment.plan_id,
          revision: assignment.id,
        }),
      }, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("recipient_user_id").maybeSingle();
      if (insertedNotification) {
        await dispatchPush([profile.userId], { title, body, href: "/?tab=today" });
      }
    }
  }

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
