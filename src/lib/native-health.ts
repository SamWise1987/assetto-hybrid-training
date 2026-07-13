import { Capacitor } from "@capacitor/core";
import type { RunSession, RunSessionSource } from "./types";

export type NativeHealthPlatform = "ios" | "android" | "web";

export interface NativeHealthAvailability {
  available: boolean;
  platform: NativeHealthPlatform;
  reason?: string;
  isNative: boolean;
}

export interface NativeWorkoutImportResult {
  imported: number;
  skipped: number;
  workouts: RunSession[];
}

const RUN_TYPES = new Set([
  "running",
  "runningTreadmill",
  "walking",
  "hiking",
  "trackAndField",
]);

function sourceForPlatform(platform: NativeHealthPlatform): RunSessionSource {
  if (platform === "ios") return "apple_health";
  if (platform === "android") return "health_connect";
  return "manual";
}

export function isNativeShell() {
  return Capacitor.isNativePlatform();
}

export function getNativePlatform(): NativeHealthPlatform {
  const platform = Capacitor.getPlatform();
  if (platform === "ios" || platform === "android") return platform;
  return "web";
}

export async function getNativeHealthAvailability(): Promise<NativeHealthAvailability> {
  const platform = getNativePlatform();
  if (!Capacitor.isNativePlatform()) {
    return {
      available: false,
      platform: "web",
      isNative: false,
      reason: "Disponibile solo nell'app iOS/Android (Capacitor).",
    };
  }

  try {
    const { Health } = await import("@capgo/capacitor-health");
    const result = await Health.isAvailable();
    return {
      available: result.available,
      platform: (result.platform as NativeHealthPlatform) ?? platform,
      reason: result.reason,
      isNative: true,
    };
  } catch (error) {
    return {
      available: false,
      platform,
      isNative: true,
      reason: error instanceof Error ? error.message : "Plugin salute non disponibile.",
    };
  }
}

export async function requestNativeHealthAccess() {
  const { Health } = await import("@capgo/capacitor-health");
  return Health.requestAuthorization({
    read: ["workouts", "distance", "heartRate", "calories", "exerciseTime"],
    write: [],
    requestHistoryAccess: true,
  });
}

function paceFrom(distanceKm: number, durationMinutes: number) {
  if (!distanceKm) return undefined;
  const pace = durationMinutes / distanceKm;
  return `${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, "0")}`;
}

export function nativeWorkoutToRunSession(
  workout: {
    workoutType: string;
    duration: number;
    totalDistance?: number;
    startDate: string;
    endDate: string;
    sourceName?: string;
    sourceId?: string;
    platformId?: string;
  },
  platform: NativeHealthPlatform,
): RunSession | null {
  if (!RUN_TYPES.has(workout.workoutType)) return null;

  const durationMinutes = Math.max(1, Math.round(workout.duration / 60));
  const distanceKm = workout.totalDistance
    ? Math.round((workout.totalDistance / 1000) * 100) / 100
    : undefined;

  const type: RunSession["type"] =
    workout.workoutType === "walking" || workout.workoutType === "hiking"
      ? "walk"
      : durationMinutes >= 50
        ? "long-easy"
        : "easy";

  return {
    id: crypto.randomUUID(),
    date: workout.startDate.slice(0, 10),
    type,
    status: "complete",
    durationMinutes,
    distanceKm,
    averagePace: distanceKm ? paceFrom(distanceKm, durationMinutes) : undefined,
    rpe: 4,
    talkTest: "full-sentences",
    symptomsDuring: 0,
    source: sourceForPlatform(platform),
    externalId: workout.platformId ?? `${workout.sourceId ?? "native"}-${workout.startDate}`,
  };
}

export async function importNativeWorkouts(afterDays = 30): Promise<NativeWorkoutImportResult> {
  const availability = await getNativeHealthAvailability();
  if (!availability.available) {
    throw new Error(availability.reason ?? "Salute nativa non disponibile.");
  }

  await requestNativeHealthAccess();

  const { Health } = await import("@capgo/capacitor-health");
  const startDate = new Date(Date.now() - afterDays * 86_400_000).toISOString();
  const endDate = new Date().toISOString();

  const workouts: RunSession[] = [];
  let anchor: string | undefined;
  do {
    const page = await Health.queryWorkouts({
      startDate,
      endDate,
      limit: 50,
      ascending: false,
      anchor,
    });
    for (const workout of page.workouts) {
      const run = nativeWorkoutToRunSession(workout, availability.platform);
      if (run) workouts.push(run);
    }
    anchor = page.anchor ?? undefined;
  } while (anchor);

  const { importExternalRun } = await import("./db");
  let imported = 0;
  let skipped = 0;
  for (const run of workouts) {
    const result = await importExternalRun(run);
    if (result.imported) imported += 1;
    else skipped += 1;
  }

  return { imported, skipped, workouts };
}
