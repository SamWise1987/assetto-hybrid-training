import type { ExternalWorkout } from "./types";

export function isTemporalHealthDuplicate(a: ExternalWorkout, b: ExternalWorkout) {
  return a.source === b.source
    && a.kind === b.kind
    && Math.abs(new Date(a.startDate).getTime() - new Date(b.startDate).getTime()) <= 120_000
    && Math.abs(a.durationMinutes - b.durationMinutes) <= 2;
}

export function externalWorkoutCountsForAdherence(workout: ExternalWorkout) {
  return Boolean(workout.matchedTemplateId && workout.matchedAt);
}

export function externalWorkoutCanDriveSetProgression(workout: ExternalWorkout) {
  return workout.kind !== "strength";
}
