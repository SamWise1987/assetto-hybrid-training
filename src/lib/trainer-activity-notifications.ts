import { notificationDedupeKey } from "./notification-events";
import { dispatchPush } from "./push-server";
import { createServiceSupabaseClient } from "./supabase/server";

export async function notifyTrainersOfExternalWorkouts(athleteUserId: string, workoutIds: string[]) {
  const entityIds = [...new Set(workoutIds)];
  if (!entityIds.length) return { notified: 0 };

  const service = createServiceSupabaseClient();
  if (!service) return { notified: 0, error: "Servizio notifiche non configurato." };

  const { data: relationships, error: relationshipsError } = await service
    .from("trainer_clients")
    .select("trainer_user_id")
    .eq("athlete_user_id", athleteUserId)
    .eq("status", "active");
  if (relationshipsError) return { notified: 0, error: relationshipsError.message };

  const recipients = [...new Set((relationships ?? []).map((item) => item.trainer_user_id))];
  if (!recipients.length) return { notified: 0 };

  const { data: inserted, error } = await service.from("app_notifications").upsert(
    recipients.flatMap((recipient) => entityIds.map((entityId) => ({
      recipient_user_id: recipient,
      actor_user_id: athleteUserId,
      type: "external_workout_completed",
      title: "Nuova attività sincronizzata",
      body: "Il cliente ha registrato una nuova attività.",
      href: "/?tab=clients",
      entity_type: "external_workout",
      entity_id: entityId,
      dedupe_key: notificationDedupeKey({
        recipientUserId: recipient,
        type: "external_workout_completed",
        entityId,
      }),
    }))),
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  ).select("recipient_user_id");
  if (error) return { notified: 0, error: error.message };

  const pushRecipients = [...new Set((inserted ?? []).map((item) => item.recipient_user_id))];
  if (pushRecipients.length) {
    await dispatchPush(pushRecipients, {
      title: "Nuova attività registrata",
      body: "Un cliente ha completato un allenamento.",
      href: "/?tab=clients",
    });
  }
  return { notified: inserted?.length ?? 0 };
}
