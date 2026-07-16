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
      plannedSessionsPerWeek: 2,
      now: new Date("2026-07-16T12:00:00.000Z"),
    });

    expect(summary.weeksLogged).toBeGreaterThan(0);
    expect(summary.runWeekly[0]?.distance).toBe(6);
    expect(summary.adherencePercent).toBe(50);
    const duplicatedHealth = buildProgressSummary({
      workouts,
      runs,
      readiness: [],
      blockWeek: 2,
      plannedSessionsPerWeek: 2,
      now: new Date("2026-07-16T12:00:00.000Z"),
      matchedExternalWorkouts: [{ startDate: "2026-07-07T11:00:00.000Z", matchedTemplateId: "strength-a" }],
    });
    expect(duplicatedHealth.adherencePercent).toBe(summary.adherencePercent);

    const additionalHealth = buildProgressSummary({
      workouts,
      runs,
      readiness: [],
      blockWeek: 2,
      plannedSessionsPerWeek: 2,
      now: new Date("2026-07-16T12:00:00.000Z"),
      matchedExternalWorkouts: [
        { startDate: "2026-07-10T11:00:00.000Z", matchedTemplateId: "strength-b" },
        { startDate: "2026-07-10T12:00:00.000Z", matchedTemplateId: "strength-b" },
        { startDate: "2026-06-20T11:00:00.000Z", matchedTemplateId: "strength-c" },
      ],
    });
    expect(additionalHealth.adherencePercent).toBe(75);
  });

  it("esclude dall'aderenza le attività precedenti al blocco corrente", () => {
    const oldWorkout: WorkoutSession = {
      id: "old",
      templateId: "strength-a",
      date: "2026-05-01",
      status: "complete",
      setLogs: [],
      modifiedExerciseIds: [],
      skippedExerciseIds: [],
    };

    const summary = buildProgressSummary({
      workouts: [oldWorkout],
      runs: [],
      readiness: [],
      blockWeek: 2,
      plannedSessionsPerWeek: 4,
      now: new Date("2026-07-16T12:00:00.000Z"),
    });

    expect(summary.adherencePercent).toBe(0);
  });
});
