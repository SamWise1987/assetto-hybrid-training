import type { RunSession } from "./types";

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  elapsed_time: number;
  distance: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain?: number;
  suffer_score?: number;
}

export function stravaActivityToRunSession(activity: StravaActivity): RunSession | null {
  const isRun = ["Run", "TrailRun", "VirtualRun", "Walk"].includes(activity.sport_type);
  if (!isRun) return null;

  const durationMinutes = Math.max(1, Math.round(activity.elapsed_time / 60));
  const distanceKm = Math.round((activity.distance / 1000) * 100) / 100;
  const paceMinutes = distanceKm > 0 ? durationMinutes / distanceKm : 0;
  const date = activity.start_date.slice(0, 10);

  const type: RunSession["type"] =
    activity.sport_type === "Walk"
      ? "walk"
      : durationMinutes >= 50
        ? "long-easy"
        : "easy";

  return {
    id: crypto.randomUUID(),
    date,
    type,
    status: "complete",
    durationMinutes,
    distanceKm,
    averagePace: distanceKm
      ? `${Math.floor(paceMinutes)}:${String(Math.round((paceMinutes % 1) * 60)).padStart(2, "0")}`
      : undefined,
    rpe: activity.suffer_score ? Math.min(10, Math.round(activity.suffer_score / 10)) : 4,
    talkTest: "full-sentences",
    symptomsDuring: 0,
    source: "strava",
    externalId: String(activity.id),
    elevationGainM: activity.total_elevation_gain
      ? Math.round(activity.total_elevation_gain)
      : undefined,
    averageHeartRate: activity.average_heartrate
      ? Math.round(activity.average_heartrate)
      : undefined,
    maxHeartRate: activity.max_heartrate ? Math.round(activity.max_heartrate) : undefined,
  };
}

export function isStravaConfigured() {
  return Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}
