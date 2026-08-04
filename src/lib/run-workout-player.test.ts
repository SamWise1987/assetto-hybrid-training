import { describe, expect, it } from "vitest";
import {
  advanceRunWorkoutClock,
  createRunWorkoutPlayerState,
  expandRunningWorkoutSegments,
  formatRunWorkoutClock,
  moveRunWorkoutStep,
  runWorkoutProgress,
  startOrPauseRunWorkout,
} from "./run-workout-player";
import type { RunningWorkoutSegment } from "./types";

const intervals: RunningWorkoutSegment[] = [
  { id: "warmup", phase: "warmup", durationSeconds: 60, instructions: "Facile" },
  { id: "work", phase: "work", repeats: 2, distanceMeters: 400, instructions: "400 metri" },
  { id: "recovery", phase: "recovery", repeats: 2, durationSeconds: 30, instructions: "Recupera" },
  { id: "cooldown", phase: "cooldown", durationSeconds: 60, instructions: "Defatica" },
];

describe("running workout player", () => {
  it("alterna lavoro e recupero quando condividono le ripetizioni", () => {
    const steps = expandRunningWorkoutSegments(intervals);

    expect(steps.map((step) => `${step.sourceSegmentId}-${step.repeatIndex}`)).toEqual([
      "warmup-1",
      "work-1",
      "recovery-1",
      "work-2",
      "recovery-2",
      "cooldown-1",
    ]);
  });

  it("avanza automaticamente i tratti a tempo e si ferma sul tratto a distanza", () => {
    const steps = expandRunningWorkoutSegments(intervals);
    const running = startOrPauseRunWorkout(createRunWorkoutPlayerState(steps));
    const afterWarmup = advanceRunWorkoutClock(running, steps, 65);

    expect(afterWarmup).toMatchObject({
      status: "running",
      activeIndex: 1,
      remainingSeconds: null,
      stepElapsedSeconds: 5,
      totalElapsedSeconds: 65,
    });
  });

  it("recupera più segmenti temporizzati dopo il ritorno dal background", () => {
    const steps = expandRunningWorkoutSegments([
      { id: "one", phase: "warmup", durationSeconds: 10, instructions: "Uno" },
      { id: "two", phase: "work", durationSeconds: 20, instructions: "Due" },
      { id: "three", phase: "cooldown", durationSeconds: 30, instructions: "Tre" },
    ]);
    const running = startOrPauseRunWorkout(createRunWorkoutPlayerState(steps));
    const advanced = advanceRunWorkoutClock(running, steps, 35);

    expect(advanced).toMatchObject({ activeIndex: 2, remainingSeconds: 25, totalElapsedSeconds: 35, status: "running" });
    expect(runWorkoutProgress(advanced, steps)).toBeCloseTo(2.1666 / 3, 3);
  });

  it("supporta pausa, avanzamento manuale e completamento", () => {
    const steps = expandRunningWorkoutSegments(intervals);
    const started = startOrPauseRunWorkout(createRunWorkoutPlayerState(steps));
    const paused = startOrPauseRunWorkout(started);
    const next = moveRunWorkoutStep(paused, steps, 1);
    const complete = moveRunWorkoutStep({ ...next, activeIndex: steps.length - 1 }, steps, 1);

    expect(paused.status).toBe("paused");
    expect(next).toMatchObject({ activeIndex: 1, status: "paused", remainingSeconds: null });
    expect(complete.status).toBe("complete");
    expect(runWorkoutProgress(complete, steps)).toBe(1);
    expect(formatRunWorkoutClock(125)).toBe("02:05");
  });
});
