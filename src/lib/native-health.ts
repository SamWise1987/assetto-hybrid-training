import { Capacitor } from "@capacitor/core";
import type { ExternalWorkout, RunSession, RunSessionSource } from "./types";
import { stableRecordId } from "./stable-id";

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
  externalWorkouts: ExternalWorkout[];
  importedRuns: number;
  importedStrength: number;
}

const RUN_TYPES = new Set([
  "running",
  "runningTreadmill",
  "walking",
  "hiking",
  "trackAndField",
]);

const STRENGTH_TYPES = new Set([
  "functionalStrengthTraining",
  "strengthTraining",
  "traditionalStrengthTraining",
  "weightlifting",
  "crossTraining",
  "highIntensityIntervalTraining",
  "calisthenics",
  "coreTraining",
]);

export interface NativeWorkoutRecord {
  workoutType: string;
  duration: number;
  totalEnergyBurned?: number;
  totalDistance?: number;
  startDate: string;
  endDate: string;
  sourceName?: string;
  sourceId?: string;
  platformId?: string;
  averageHeartRate?: number;
  maxHeartRate?: number;
}

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
  const platform = getNativePlatform();
  const result = await Health.requestAuthorization({
    read: nativeHealthReadTypes(platform),
    write: [],
    requestHistoryAccess: true,
  });
  if (result.readDenied.includes("workouts")) throw new Error("Permesso di lettura allenamenti non concesso.");
  return result;
}

export function nativeHealthReadTypes(platform: NativeHealthPlatform) {
  const shared = ["workouts", "distance", "heartRate", "calories"] as const;
  // Health Connect non espone exerciseTime nel plugin: includerlo rifiuta
  // l'intera richiesta Android come tipo non supportato.
  return platform === "ios" ? [...shared, "exerciseTime" as const] : [...shared];
}

// Apple Watch può consegnare all'iPhone un workout diverse ore dopo la fine.
// Rileggere le ultime 48 ore è sicuro perché ID nativo e fallback temporale
// rendono l'import idempotente.
const HEALTH_SYNC_OVERLAP_MS = 48 * 60 * 60 * 1000;

export function nativeHealthSyncStartDate(afterDays: number, lastSuccessfulSyncAt?: string, now = Date.now()) {
  if (lastSuccessfulSyncAt) {
    const previous = new Date(lastSuccessfulSyncAt).getTime();
    if (Number.isFinite(previous) && previous <= now) {
      return new Date(Math.max(0, previous - HEALTH_SYNC_OVERLAP_MS)).toISOString();
    }
  }
  return new Date(now - Math.max(1, afterDays) * 86_400_000).toISOString();
}

function paceFrom(distanceKm: number, durationMinutes: number) {
  if (!distanceKm) return undefined;
  const pace = durationMinutes / distanceKm;
  return `${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, "0")}`;
}

export function nativeWorkoutToRunSession(
  workout: NativeWorkoutRecord,
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
    id: stableRecordId(sourceForPlatform(platform), workout.platformId ?? `${workout.sourceId ?? "native"}-${workout.startDate}`),
    date: workout.startDate.slice(0, 10),
    type,
    status: "complete",
    durationMinutes,
    distanceKm,
    averagePace: distanceKm ? paceFrom(distanceKm, durationMinutes) : undefined,
    rpe: 0,
    averageHeartRate: workout.averageHeartRate,
    maxHeartRate: workout.maxHeartRate,
    talkTest: "full-sentences",
    symptomsDuring: 0,
    subjectiveDataAvailable: false,
    source: sourceForPlatform(platform),
    platform: platform === "web" ? "web" : platform,
    deviceName: workout.sourceName,
    externalId: workout.platformId ?? `${workout.sourceId ?? "native"}-${workout.startDate}`,
  };
}

export function nativeWorkoutToExternalWorkout(
  workout: NativeWorkoutRecord,
  platform: NativeHealthPlatform,
): ExternalWorkout | null {
  if (platform === "web") return null;
  const isRun = RUN_TYPES.has(workout.workoutType);
  const isStrength = STRENGTH_TYPES.has(workout.workoutType);
  if (!isRun && !isStrength) return null;

  const distanceKm = workout.totalDistance
    ? Math.round((workout.totalDistance / 1000) * 100) / 100
    : undefined;
  const externalId = workout.platformId ?? `${workout.sourceId ?? platform}-${workout.startDate}`;
  const kind: ExternalWorkout["kind"] = isStrength
    ? "strength"
    : workout.workoutType === "walking" || workout.workoutType === "hiking"
      ? "walk"
      : "run";

  return {
    id: stableRecordId(platform === "ios" ? "apple_health" : "health_connect", externalId),
    externalId,
    source: platform === "ios" ? "apple_health" : "health_connect",
    platform,
    workoutType: workout.workoutType,
    kind,
    startDate: workout.startDate,
    endDate: workout.endDate,
    durationMinutes: Math.max(1, Math.round(workout.duration / 60)),
    distanceKm,
    caloriesKcal: workout.totalEnergyBurned,
    averageHeartRate: workout.averageHeartRate,
    maxHeartRate: workout.maxHeartRate,
    sourceName: workout.sourceName,
    importedAt: new Date().toISOString(),
  };
}

export async function importNativeWorkouts(afterDays = 30, lastSuccessfulSyncAt?: string): Promise<NativeWorkoutImportResult> {
  const availability = await getNativeHealthAvailability();
  if (!availability.available) {
    throw new Error(availability.reason ?? "Salute nativa non disponibile.");
  }
  if (availability.platform === "web") {
    throw new Error("La lettura Health richiede l'app iOS o Android.");
  }

  const { db, importExternalRun, importExternalWorkout } = await import("./db");
  const stateId = `health-${availability.platform}`;
  const previousState = await db.healthSyncStates.get(stateId);
  const syncStartedAt = new Date().toISOString();
  await db.healthSyncStates.put({
    id: stateId,
    platform: availability.platform,
    status: "syncing",
    lastAttemptAt: syncStartedAt,
    lastSuccessfulSyncAt: previousState?.lastSuccessfulSyncAt,
    lastImportedCount: previousState?.lastImportedCount ?? 0,
    lastSkippedCount: previousState?.lastSkippedCount ?? 0,
  });

  await requestNativeHealthAccess();

  const { Health } = await import("@capgo/capacitor-health");
  const nowMs = Date.now();
  const startDate = nativeHealthSyncStartDate(afterDays, lastSuccessfulSyncAt, nowMs);
  const endDate = new Date(nowMs).toISOString();

  const workouts: RunSession[] = [];
  const externalWorkouts: ExternalWorkout[] = [];
  const workoutRecords: NativeWorkoutRecord[] = [];
  let anchor: string | undefined;
  do {
    const page = await Health.queryWorkouts({
      startDate,
      endDate,
      limit: 50,
      ascending: false,
      anchor,
    });
    workoutRecords.push(...page.workouts);
    anchor = page.anchor ?? undefined;
  } while (anchor);

  const heartRateSamples = await Health.readSamples({
    dataType: "heartRate",
    startDate,
    endDate,
    limit: 10_000,
    ascending: true,
  }).then((result) => result.samples).catch(() => []);

  for (const workout of workoutRecords) {
    const workoutStart = new Date(workout.startDate).getTime();
    const workoutEnd = new Date(workout.endDate).getTime();
    const heartRates = heartRateSamples
      .filter((sample) => {
        const timestamp = new Date(sample.startDate).getTime();
        return timestamp >= workoutStart && timestamp <= workoutEnd;
      })
      .map((sample) => sample.value)
      .filter((value) => Number.isFinite(value) && value > 0);
    const enriched: NativeWorkoutRecord = heartRates.length
      ? {
          ...workout,
          averageHeartRate: Math.round(heartRates.reduce((total, value) => total + value, 0) / heartRates.length),
          maxHeartRate: Math.round(Math.max(...heartRates)),
        }
      : workout;
    const external = nativeWorkoutToExternalWorkout(enriched, availability.platform);
    if (external) externalWorkouts.push(external);
    const run = nativeWorkoutToRunSession(enriched, availability.platform);
    if (run) workouts.push(run);
  }

  let imported = 0;
  let skipped = 0;
  let importedStrength = 0;
  let importedRuns = 0;
  const canonicalExternal: ExternalWorkout[] = [];
  for (const external of externalWorkouts) {
    const result = await importExternalWorkout(external);
    canonicalExternal.push(result.workout);
    if (result.imported) {
      imported += 1;
      if (external.kind === "strength") importedStrength += 1;
    } else {
      skipped += 1;
    }
  }
  for (const run of workouts) {
    const result = await importExternalRun(run);
    if (result.imported) importedRuns += 1;
  }

  const now = new Date().toISOString();
  await db.healthSyncStates.put({
    id: stateId,
    platform: availability.platform,
    status: "success",
    lastAttemptAt: now,
    lastSuccessfulSyncAt: now,
    lastImportedCount: imported,
    lastSkippedCount: skipped,
  });

  const { pushExternalWorkouts } = await import("./remote-sync");
  await pushExternalWorkouts(canonicalExternal, {
    platform: availability.platform,
    status: "success",
    lastAttemptAt: now,
    lastSuccessfulSyncAt: now,
    imported,
    skipped,
  }).then(async () => {
    await db.externalWorkouts.bulkPut(canonicalExternal.map((workout) => ({ ...workout, syncedAt: now })));
    const ids = new Set(canonicalExternal.map((workout) => workout.id));
    const queued = await db.syncQueue.where("entity").equals("external_workout").toArray();
    await db.syncQueue.bulkDelete(queued.filter((item) => ids.has(item.entityId)).map((item) => item.id));
  }).catch(() => undefined);

  // Le corse importate vengono accodate come log normalizzati: prova a
  // inviarle nello stesso ciclo, lasciandole in IndexedDB se il device è offline.
  const { flushSyncQueue } = await import("./normalized-sync");
  await flushSyncQueue().catch(() => undefined);

  return { imported, skipped, workouts, externalWorkouts: canonicalExternal, importedRuns, importedStrength };
}

export async function recordNativeHealthFailure(error: unknown) {
  const platform = getNativePlatform();
  if (platform === "web") return;
  const message = error instanceof Error ? error.message : "Sync Health non riuscito.";
  const denied = /permesso|permission|denied/i.test(message);
  const now = new Date().toISOString();
  const { db } = await import("./db");
  await db.healthSyncStates.put({
    id: `health-${platform}`,
    platform,
    status: denied ? "denied" : "error",
    lastAttemptAt: now,
    lastImportedCount: 0,
    lastSkippedCount: 0,
    errorMessage: message,
  });
  const { pushExternalWorkouts } = await import("./remote-sync");
  await pushExternalWorkouts([], {
    platform,
    status: denied ? "denied" : "error",
    lastAttemptAt: now,
    imported: 0,
    skipped: 0,
    errorMessage: message,
  }).catch(() => undefined);
  const { reportAppError } = await import("./error-monitor");
  await reportAppError("health", error, { platform }).catch(() => undefined);
}
