import { describe, expect, it } from "vitest";
import { buildProgressSummary } from "./progress-analytics";
import type { RunSession, WorkoutSession } from "./types";

describe("buildProgressSummary", () => {
  it("builds live metrics from stored sessions", () => {
    const workouts: WorkoutSession[] = [
      {
        id: "w1",
        templateId: "strength-a",
        date: "2026-07-07",
        status: "complete",
        setLogs: [
          {
            id: "s1",
            sessionId: "w1",
            prescriptionId: "a1",
            setNumber: 1,
            weightPerDumbbellKg: 16,
            dumbbellCount: 2,
            side: "bilateral",
            reps: 10,
            rir: 2,
            shoulderPain: 0,
            cervicalSymptoms: 0,
            technique: "stable",
            variant: "standard",
            tempo: "2-0-1",
            rangeOfMotion: "completo",
            confirmedAt: "2026-07-07T10:00:00.000Z",
          },
        ],
        modifiedExerciseIds: [],
        skippedExerciseIds: [],
      },
    ];
    const runs: RunSession[] = [
      {
        id: "r1",
        date: "2026-07-08",
        type: "easy",
        status: "complete",
        durationMinutes: 40,
        distanceKm: 6,
        rpe: 4,
        talkTest: "full-sentences",
        symptomsDuring: 0,
      },
    ];

    const summary = buildProgressSummary({
      workouts,
      runs,
      readiness: [],
      blockWeek: 2,
    });

    expect(summary.weeksLogged).toBeGreaterThan(0);
    expect(summary.runWeekly[0]?.distance).toBe(6);
    expect(summary.adherencePercent).toBeGreaterThan(0);
  });
});
