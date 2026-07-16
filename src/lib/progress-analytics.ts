import { format, startOfWeek, subWeeks } from "date-fns";
import { EXERCISES } from "./program";
import { exerciseIdForPrescription } from "./prescription-index";
import { countUniqueMatchedExternal } from "./adherence-dedupe";
import type { DailyReadiness, ExternalWorkout, RunSession, WorkoutSession } from "./types";

export interface WeeklyRunStats {
  week: string;
  easy: number;
  quality: number;
  distance: number;
}

export interface WeeklyRecoveryStats {
  week: string;
  energy: number;
  shoulder: number;
  cervical: number;
  rir: number;
}

export interface PatternVolume {
  pattern: string;
  sets: number;
}

export interface ProgressSummary {
  adherencePercent: number;
  averageRir: number;
  latestWeekDistanceKm: number;
  weeksLogged: number;
  runWeekly: WeeklyRunStats[];
  recoveryWeekly: WeeklyRecoveryStats[];
  volumeByPattern: PatternVolume[];
}

const weekKey = (date: string) => {
  const start = startOfWeek(new Date(`${date}T12:00:00`), { weekStartsOn: 1 });
  return format(start, "yyyy-MM-dd");
};

const weekLabel = (index: number) => `S${index + 1}`;

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const patternLabels: Record<string, string> = {
  "spinta orizzontale": "Spinta",
  "tirata orizzontale": "Tirata",
  squat: "Squat",
  hinge: "Hinge",
  "core anti-estensione": "Core",
  "core anti-flessione": "Core",
  "core anti-rotazione": "Core",
  "estensione anca": "Glutei",
  polpacci: "Polpacci",
  "controllo scapolare": "Spalle",
};

export function buildProgressSummary(input: {
  workouts: readonly WorkoutSession[];
  runs: readonly RunSession[];
  readiness: readonly DailyReadiness[];
  blockWeek: number;
  plannedSessionsPerWeek: number;
  matchedExternalWorkouts?: readonly Pick<ExternalWorkout, "startDate" | "matchedTemplateId">[];
  now?: Date;
}): ProgressSummary {
  const completedWorkouts = input.workouts.filter((session) => session.status === "complete");
  const completedRuns = input.runs.filter((run) => run.status === "complete");

  const weekKeys = [...new Set([
    ...completedWorkouts.map((session) => weekKey(session.date)),
    ...completedRuns.map((run) => weekKey(run.date)),
  ])].sort();

  const runWeekly = weekKeys.map((key, index) => {
    const weekRuns = completedRuns.filter((run) => weekKey(run.date) === key);
    const easy = weekRuns
      .filter((run) => run.type === "easy" || run.type === "long-easy" || run.type === "walk")
      .reduce((total, run) => total + run.durationMinutes, 0);
    const quality = weekRuns
      .filter((run) => run.type === "controlled-quality")
      .reduce((total, run) => total + run.durationMinutes, 0);
    const distance = weekRuns.reduce((total, run) => total + (run.distanceKm ?? 0), 0);
    return { week: weekLabel(index), easy, quality, distance: Math.round(distance * 10) / 10 };
  });

  const recoveryWeekly = weekKeys.map((key, index) => {
    const weekReadiness = input.readiness.filter((entry) => weekKey(entry.date) === key);
    const weekLogs = completedWorkouts
      .filter((session) => weekKey(session.date) === key)
      .flatMap((session) => session.setLogs);
    return {
      week: weekLabel(index),
      energy: Math.round(average(weekReadiness.map((entry) => entry.energy)) * 10) / 10,
      shoulder: Math.round(average(weekReadiness.map((entry) => entry.shoulderPain)) * 10) / 10,
      cervical: Math.round(average(weekReadiness.map((entry) => entry.cervicalPain)) * 10) / 10,
      rir: Math.round(average(weekLogs.map((log) => log.rir)) * 10) / 10,
    };
  });

  const patternSets = new Map<string, number>();
  for (const session of completedWorkouts) {
    for (const log of session.setLogs) {
      const exerciseId = exerciseIdForPrescription(log.prescriptionId);
      const exercise = EXERCISES.find((entry) => entry.id === exerciseId);
      const label = patternLabels[exercise?.pattern ?? ""] ?? exercise?.pattern ?? "Altro";
      patternSets.set(label, (patternSets.get(label) ?? 0) + 1);
    }
  }

  const volumeByPattern = [...patternSets.entries()]
    .map(([pattern, sets]) => ({ pattern, sets }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 6);

  const now = input.now ?? new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const latestWeekRuns = completedRuns.filter((run) => new Date(`${run.date}T12:00:00`) >= weekStart);
  const latestWeekLogs = completedWorkouts
    .filter((session) => new Date(`${session.date}T12:00:00`) >= weekStart)
    .flatMap((session) => session.setLogs);

  const normalizedBlockWeek = Math.max(1, Math.min(8, input.blockWeek));
  const blockStart = format(subWeeks(weekStart, normalizedBlockWeek - 1), "yyyy-MM-dd");
  const today = format(now, "yyyy-MM-dd");
  const completedBlockWorkouts = completedWorkouts.filter((session) => session.date >= blockStart && session.date <= today);
  const completedBlockRuns = completedRuns.filter((run) => run.date >= blockStart && run.date <= today);
  const matchedExternalCount = countUniqueMatchedExternal({
    fromDate: blockStart,
    toDate: today,
    completedWorkouts: completedBlockWorkouts.map((session) => ({ date: session.date, templateId: session.templateId })),
    matchedExternal: (input.matchedExternalWorkouts ?? []).flatMap((workout) => workout.matchedTemplateId
      ? [{ date: workout.startDate.slice(0, 10), templateId: workout.matchedTemplateId }]
      : []),
  });
  const plannedSessions = Math.max(1, normalizedBlockWeek * Math.max(1, input.plannedSessionsPerWeek));
  const adherencePercent = Math.min(
    100,
    Math.round(((completedBlockWorkouts.length + completedBlockRuns.length + matchedExternalCount) / plannedSessions) * 100),
  );

  return {
    adherencePercent,
    averageRir: Math.round(average(latestWeekLogs.map((log) => log.rir)) * 10) / 10,
    latestWeekDistanceKm: Math.round(
      latestWeekRuns.reduce((total, run) => total + (run.distanceKm ?? 0), 0) * 10,
    ) / 10,
    weeksLogged: weekKeys.length,
    runWeekly: runWeekly.length ? runWeekly : [{ week: "S1", easy: 0, quality: 0, distance: 0 }],
    recoveryWeekly: recoveryWeekly.length
      ? recoveryWeekly
      : [{ week: "S1", energy: 0, shoulder: 0, cervical: 0, rir: 0 }],
    volumeByPattern: volumeByPattern.length ? volumeByPattern : [{ pattern: "Nessun dato", sets: 0 }],
  };
}

export function countRecentWeeksWithData(workouts: readonly WorkoutSession[], runs: readonly RunSession[]) {
  const keys = new Set<string>();
  for (const session of workouts) keys.add(weekKey(session.date));
  for (const run of runs) keys.add(weekKey(run.date));
  return keys.size;
}
