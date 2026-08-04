import type { RunningWorkoutSegment } from "./types";

export type RunWorkoutPlayerStatus = "idle" | "running" | "paused" | "complete";

export interface RunWorkoutStep extends RunningWorkoutSegment {
  stepId: string;
  sourceSegmentId: string;
  repeatIndex: number;
  repeatTotal: number;
}

export interface RunWorkoutPlayerState {
  status: RunWorkoutPlayerStatus;
  activeIndex: number;
  remainingSeconds: number | null;
  stepElapsedSeconds: number;
  totalElapsedSeconds: number;
}

const safeRepeatCount = (segment: RunningWorkoutSegment) => Math.max(1, Math.min(100, Math.floor(segment.repeats ?? 1)));

function repeatedStep(segment: RunningWorkoutSegment, repeatIndex: number, repeatTotal: number): RunWorkoutStep {
  return {
    ...segment,
    stepId: `${segment.id}:${repeatIndex}`,
    sourceSegmentId: segment.id,
    repeatIndex,
    repeatTotal,
  };
}

/**
 * Espande la prescrizione del trainer nella sequenza effettiva del player.
 * Un blocco lavoro seguito da un recupero con lo stesso numero di ripetizioni
 * viene alternato, come in “6 × 400 m / 2 min recupero”.
 */
export function expandRunningWorkoutSegments(segments: readonly RunningWorkoutSegment[]): RunWorkoutStep[] {
  const steps: RunWorkoutStep[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const repeats = safeRepeatCount(segment);
    const recovery = segments[index + 1];
    const recoveryRepeats = recovery ? safeRepeatCount(recovery) : 1;
    const pairedRecovery = segment.phase === "work"
      && repeats > 1
      && recovery?.phase === "recovery"
      && recoveryRepeats === repeats;

    if (pairedRecovery && recovery) {
      for (let repeat = 1; repeat <= repeats; repeat += 1) {
        steps.push(repeatedStep(segment, repeat, repeats));
        steps.push(repeatedStep(recovery, repeat, repeats));
      }
      index += 1;
      continue;
    }

    for (let repeat = 1; repeat <= repeats; repeat += 1) {
      steps.push(repeatedStep(segment, repeat, repeats));
    }
  }

  return steps;
}

function durationForStep(step: RunWorkoutStep | undefined) {
  return step?.durationSeconds && step.durationSeconds > 0 ? Math.round(step.durationSeconds) : null;
}

export function createRunWorkoutPlayerState(steps: readonly RunWorkoutStep[]): RunWorkoutPlayerState {
  return {
    status: "idle",
    activeIndex: 0,
    remainingSeconds: durationForStep(steps[0]),
    stepElapsedSeconds: 0,
    totalElapsedSeconds: 0,
  };
}

export function startOrPauseRunWorkout(state: RunWorkoutPlayerState): RunWorkoutPlayerState {
  if (state.status === "complete") return state;
  return { ...state, status: state.status === "running" ? "paused" : "running" };
}

export function moveRunWorkoutStep(
  state: RunWorkoutPlayerState,
  steps: readonly RunWorkoutStep[],
  direction: 1 | -1,
): RunWorkoutPlayerState {
  if (!steps.length) return { ...state, status: "complete" };
  const nextIndex = state.activeIndex + direction;
  if (nextIndex >= steps.length) {
    return {
      ...state,
      status: "complete",
      activeIndex: steps.length - 1,
      remainingSeconds: 0,
      stepElapsedSeconds: durationForStep(steps.at(-1)) ?? state.stepElapsedSeconds,
    };
  }
  const boundedIndex = Math.max(0, nextIndex);
  return {
    ...state,
    status: state.status === "complete" ? "paused" : state.status,
    activeIndex: boundedIndex,
    remainingSeconds: durationForStep(steps[boundedIndex]),
    stepElapsedSeconds: 0,
  };
}

/** Applica anche intervalli lunghi, per esempio dopo il ritorno dal background. */
export function advanceRunWorkoutClock(
  state: RunWorkoutPlayerState,
  steps: readonly RunWorkoutStep[],
  elapsedSeconds: number,
): RunWorkoutPlayerState {
  if (state.status !== "running" || elapsedSeconds <= 0 || !steps.length) return state;

  const next = { ...state };
  let secondsLeft = Math.floor(elapsedSeconds);

  while (secondsLeft > 0 && next.status === "running") {
    const step = steps[next.activeIndex];
    if (!step) return { ...next, status: "complete" };

    const timedDuration = durationForStep(step);
    if (timedDuration === null) {
      next.stepElapsedSeconds += secondsLeft;
      next.totalElapsedSeconds += secondsLeft;
      return next;
    }

    const remaining = next.remainingSeconds ?? timedDuration;
    const consumed = Math.min(remaining, secondsLeft);
    next.remainingSeconds = remaining - consumed;
    next.stepElapsedSeconds += consumed;
    next.totalElapsedSeconds += consumed;
    secondsLeft -= consumed;

    if (next.remainingSeconds === 0) {
      if (next.activeIndex >= steps.length - 1) {
        next.status = "complete";
        return next;
      }
      next.activeIndex += 1;
      next.remainingSeconds = durationForStep(steps[next.activeIndex]);
      next.stepElapsedSeconds = 0;
    }
  }

  return next;
}

export function runWorkoutProgress(state: RunWorkoutPlayerState, steps: readonly RunWorkoutStep[]) {
  if (!steps.length) return 0;
  if (state.status === "complete") return 1;
  const step = steps[state.activeIndex];
  const duration = durationForStep(step);
  const fraction = duration ? Math.min(1, state.stepElapsedSeconds / duration) : 0;
  return Math.min(1, (state.activeIndex + fraction) / steps.length);
}

export function formatRunWorkoutClock(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}
