import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { mapRemotePlan, requireStaff, staffClient } from "@/lib/supabase/profiles";
import type { Database } from "@/lib/supabase/client";
import { dispatchPush } from "@/lib/push-server";
import { notificationDedupeKey } from "@/lib/notification-events";

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional(),
  sessions: z.array(
    z.object({
      templateId: z.string(),
      dayOfWeek: z.number().int().min(0).max(6),
      displayName: z.string().min(1).max(120),
      kind: z.enum(["strength", "run", "recovery", "free"]),
      estimatedMinutes: z.number().int().min(0).max(300),
      notes: z.array(z.string()).optional(),
      prescriptions: z.array(z.unknown()).optional(),
      runConfig: z.object({
        type: z.enum(["easy", "long-easy", "controlled-quality", "walk"]),
        durationMinutes: z.number().int().min(1).max(300),
        notes: z.array(z.string()).optional(),
        workoutTemplateId: z.string().optional(),
        segments: z.array(z.unknown()).optional(),
      }).optional(),
    }),
  ).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff(request);
  if (!staff) return jsonError("Solo admin e coach possono modificare i piani.", 403);

  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Aggiornamento non valido.");

  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);

  const patch: Database["public"]["Tables"]["training_plans"]["Update"] = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.sessions !== undefined) {
    patch.sessions = parsed.data.sessions as Database["public"]["Tables"]["training_plans"]["Insert"]["sessions"];
  }

  let update = client
    .from("training_plans")
    .update(patch)
    .eq("id", id);
  if (staff.role !== "admin") update = update.eq("created_by", staff.userId);
  const { data, error } = await update.select("*").single();

  if (error) return jsonError(error.message, 500);
  const { data: latestVersion } = await client.from("plan_versions").select("version").eq("plan_id", id).order("version", { ascending: false }).limit(1).maybeSingle();
  const nextVersion = (latestVersion?.version ?? 0) + 1;
  const { error: versionError } = await client.from("plan_versions").insert({
    plan_id: id,
    version: nextVersion,
    snapshot: data as unknown as Database["public"]["Tables"]["plan_versions"]["Insert"]["snapshot"],
    reason: "Aggiornamento del trainer",
    created_by: staff.userId,
  });
  if (versionError) return jsonError(versionError.message, 500);
  const { data: assignments } = await client.from("plan_assignments").select("athlete_user_id").eq("plan_id", id).eq("active", true);
  const recipients = (assignments ?? []).flatMap((item) => item.athlete_user_id ? [item.athlete_user_id] : []);
  if (recipients.length) {
    const { data: insertedNotifications, error: notificationError } = await client.from("app_notifications").upsert(recipients.map((recipient) => ({
      recipient_user_id: recipient,
      actor_user_id: staff.userId,
      type: "plan_updated",
      title: "Il tuo piano è stato aggiornato",
      body: "Il trainer ha pubblicato una nuova versione del programma.",
      href: "/?tab=today",
      entity_type: "training_plan",
      entity_id: id,
      dedupe_key: notificationDedupeKey({ recipientUserId: recipient, type: "plan_updated", entityId: id, revision: nextVersion }),
    })), { onConflict: "dedupe_key", ignoreDuplicates: true }).select("recipient_user_id");
    if (notificationError) return jsonError(notificationError.message, 500);
    const pushRecipients = [...new Set((insertedNotifications ?? []).map((item) => item.recipient_user_id))];
    if (pushRecipients.length) await dispatchPush(pushRecipients, { title: "Il tuo piano è stato aggiornato", body: "Il trainer ha pubblicato una nuova versione del programma.", href: "/?tab=today" });
  }
  await client.from("audit_log").insert({ actor_user_id: staff.userId, action: "plan_updated", entity_type: "training_plan", entity_id: id, metadata: { version: nextVersion } });
  return jsonOk({ plan: mapRemotePlan(data) });
}
