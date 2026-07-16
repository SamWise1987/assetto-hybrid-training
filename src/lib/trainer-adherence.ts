import { countUniqueMatchedExternal } from "./adherence-dedupe";

interface DatedStatus {
  date: string;
  status: string;
  templateId?: string;
}

interface MatchedExternalActivity {
  date: string;
  templateId: string;
}

export interface TrainerAdherenceInput {
  workouts: DatedStatus[];
  runs: DatedStatus[];
  matchedExternal: MatchedExternalActivity[];
  followUpDates?: string[];
  plannedPerWeek: number;
  now?: number;
}

export function calculateTrainerAdherence(input: TrainerAdherenceInput) {
  const now = input.now ?? Date.now();
  const cutoff = new Date(now - 28 * 86_400_000).toISOString().slice(0, 10);
  const workoutCount = input.workouts.filter((item) => item.status === "complete" && item.date >= cutoff).length;
  const runCount = input.runs.filter((item) => item.status === "complete" && item.date >= cutoff).length;
  const matchedExternalCount = countUniqueMatchedExternal({
    fromDate: cutoff,
    completedWorkouts: input.workouts.flatMap((item) => item.status === "complete" && item.templateId
      ? [{ date: item.date, templateId: item.templateId }]
      : []),
    matchedExternal: input.matchedExternal,
  });
  const followUpCount = (input.followUpDates ?? []).filter((date) => date >= cutoff).length;
  const completed = workoutCount + runCount + matchedExternalCount;
  const planned = Math.max(1, input.plannedPerWeek) * 4;

  return {
    cutoff,
    workoutCount,
    runCount,
    matchedExternalCount,
    followUpCount,
    completed,
    percent: Math.min(100, Math.round(completed / planned * 100)),
  };
}
