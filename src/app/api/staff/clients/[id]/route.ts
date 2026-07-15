import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { mapRemotePlan, requireStaff, staffClient } from "@/lib/supabase/profiles";
import { calculateTrainerAdherence } from "@/lib/trainer-adherence";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff(request);
  if (!staff || staff.role !== "coach") return jsonError("Dettaglio disponibile soltanto al trainer assegnato.", 403);
  const parsed = z.string().uuid().safeParse((await context.params).id);
  if (!parsed.success) return jsonError("Cliente non valido.");
  const athleteUserId = parsed.data;
  const client = staffClient(request); if (!client) return jsonError("Supabase non configurato.", 503);

  const { data: relationship } = await client.from("trainer_clients").select("id").eq("trainer_user_id", staff.userId).eq("athlete_user_id", athleteUserId).eq("status", "active").maybeSingle();
  if (!relationship) return jsonError("Cliente non assegnato a questo trainer.", 403);

  const [profileResult, healthResult, workoutsResult, runsResult, followUpsResult, externalResult, assignmentResult] = await Promise.all([
    client.from("athlete_profiles").select("user_id,display_name,primary_goal,training_days,equipment,limitations,onboarding_completed_at").eq("user_id", athleteUserId).maybeSingle(),
    client.from("health_sync_states").select("platform,status,last_successful_sync_at,last_imported_count,last_skipped_count").eq("user_id", athleteUserId),
    client.from("training_session_logs").select("id,template_id,session_date,status,source,updated_at").eq("user_id", athleteUserId).order("session_date", { ascending: false }).limit(120),
    client.from("run_session_logs").select("id,session_date,status,source,payload,updated_at").eq("user_id", athleteUserId).order("session_date", { ascending: false }).limit(120),
    client.from("follow_up_logs").select("id,log_date,session_id,updated_at").eq("user_id", athleteUserId).order("log_date", { ascending: false }).limit(50),
    client.from("external_workouts").select("id,kind,source,source_name,start_date,duration_minutes,distance_km,matched_template_id").eq("user_id", athleteUserId).order("start_date", { ascending: false }).limit(60),
    client.from("plan_assignments").select("plan_id,assigned_at").eq("athlete_user_id", athleteUserId).eq("active", true).order("assigned_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (profileResult.error) return jsonError(profileResult.error.message, 500);

  let plan = null;
  if (assignmentResult.data?.plan_id) {
    const { data } = await client.from("training_plans").select("*").eq("id", assignmentResult.data.plan_id).maybeSingle();
    if (data) plan = mapRemotePlan(data);
  }
  const workouts = workoutsResult.data ?? [];
  const runs = runsResult.data ?? [];
  const external = externalResult.data ?? [];
  const plannedPerWeek = Math.max(1, plan?.sessions.filter((item) => item.kind !== "free" && item.kind !== "recovery").length ?? 1);
  const recent = calculateTrainerAdherence({
    workouts: workouts.map((item) => ({ date: item.session_date, status: item.status })),
    runs: runs.map((item) => ({ date: item.session_date, status: item.status })),
    matchedExternalDates: external.filter((item) => item.matched_template_id).map((item) => item.start_date.slice(0, 10)),
    followUpDates: (followUpsResult.data ?? []).map((item) => item.log_date),
    plannedPerWeek,
  });

  return jsonOk({
    profile: profileResult.data,
    health: healthResult.data ?? [],
    plan,
    metrics: {
      workouts: recent.workoutCount,
      runs: recent.runCount,
      followUps: recent.followUpCount,
      matchedExternal: recent.matchedExternalCount,
      adherence: recent.percent,
      windowDays: 28,
    },
    calendar: [
      ...workouts.map((item) => ({ id: item.id, date: item.session_date, kind: "strength", status: item.status, source: item.source, label: item.template_id })),
      ...runs.map((item) => ({ id: item.id, date: item.session_date, kind: "run", status: item.status, source: item.source, label: "Corsa" })),
      ...external.map((item) => ({ id: item.id, date: item.start_date.slice(0, 10), kind: item.kind, status: item.matched_template_id ? "matched" : "external", source: item.source, label: item.source_name ?? item.source })),
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30),
    external,
  });
}
