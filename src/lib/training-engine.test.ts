import { describe, expect, it } from "vitest";
import { evaluateWorkoutProgressions, mergeTemplatePrescriptions } from "./training-engine";
import type { ExercisePrescription, SetLog } from "./types";

const prescription: ExercisePrescription = {
  id: "p1",
  exerciseId: "floor-press",
  sets: 3,
  repRange: [8, 15],
  targetRir: [2, 3],
  variant: "presa neutra",
  tempo: "2-0-1",
  rangeOfMotion: "completo e confortevole",
  difficultyLevel: 0,
};

const makeLog = (overrides: Partial<SetLog> = {}): SetLog => ({
  id: "log-1",
  sessionId: "session-1",
  prescriptionId: "p1",
  setNumber: 1,
  weightPerDumbbellKg: 16,
  dumbbellCount: 2,
  side: "bilateral",
  reps: 15,
  rir: 2,
  shoulderPain: 1,
  cervicalSymptoms: 0,
  technique: "stable",
  variant: "presa neutra",
  tempo: "2-0-1",
  rangeOfMotion: "completo",
  confirmedAt: new Date().toISOString(),
  ...overrides,
});

describe("training-engine", () => {
  it("genera decisioni di progressione dal log serie", () => {
    const decisions = evaluateWorkoutProgressions({
      templateId: "strength-a",
      prescriptions: [prescription],
      setLogs: [makeLog(), makeLog({ setNumber: 2 }), makeLog({ setNumber: 3 })],
      nextDayResponse: {
        id: "n1",
        sessionId: "session-1",
        date: "2026-07-14",
        shoulderBackToBaseline: true,
        cervicalBackToBaseline: true,
        perceivedRecovery: 4,
      },
      exposureCounts: { "floor-press": 2 },
    });

    expect(decisions).toHaveLength(1);
    expect(decisions[0].action).toBe("progress");
  });

  it("applica override alle prescrizioni del template", () => {
    const merged = mergeTemplatePrescriptions("strength-a", [
      {
        id: "active-a-floor-press",
        exerciseId: "floor-press",
        templateId: "strength-a",
        prescription: { ...prescription, sets: 4 },
        updatedAt: new Date().toISOString(),
      },
    ]);
    expect(merged.find((entry) => entry.exerciseId === "floor-press")?.sets).toBe(4);
  });
});
