import { describe, expect, it } from "vitest";
import {
  adjustForReadiness,
  capWeeklyRunMinutes,
  evaluateDeload,
  evaluateExerciseProgression,
  isSundayFree,
  rescheduleSkippedRun,
  undoProgressionDecision,
} from "./autoregulation";
import type { DailyReadiness, ExercisePrescription } from "./types";

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

const exposure = {
  exerciseId: "floor-press",
  prescription,
  reps: [15, 15, 15],
  rirs: [2, 2, 3],
  pain: 1,
  technique: ["stable", "stable", "stable"] as const,
  consecutiveSuccessfulExposures: 2,
  upperBody: true,
  nextDayBackToBaseline: true,
};

const readiness = (overrides: Partial<DailyReadiness> = {}): DailyReadiness => ({
  id: "r1",
  date: "2026-07-13",
  energy: 4,
  sleep: 4,
  legSoreness: 2,
  shoulderPain: 0,
  cervicalPain: 0,
  armNeurologicalSymptoms: false,
  coordinationWorsened: false,
  ...overrides,
});

describe("motore deterministico", () => {
  it("progredisce dopo due esposizioni riuscite", () => {
    const result = evaluateExerciseProgression(exposure);
    expect(result.action).toBe("progress");
    expect(result.outputPrescription.difficultyLevel).toBe(1);
    expect(result.outputPrescription.tempo).toBe("4-1-1");
  });

  it("non progredisce upper body senza risposta nelle 24 ore", () => {
    const result = evaluateExerciseProgression({ ...exposure, nextDayBackToBaseline: undefined });
    expect(result.action).toBe("maintain");
    expect(result.rule).toBe("UPPER_BODY_REQUIRES_24H_RESPONSE");
  });

  it("regredisce quando non raggiunge il minimo", () => {
    const result = evaluateExerciseProgression({ ...exposure, reps: [8, 7, 6], consecutiveSuccessfulExposures: 0 });
    expect(result.action).toBe("reduce");
    expect(result.outputPrescription.sets).toBe(2);
  });

  it("applica hard stop per sintomi neurologici", () => {
    const result = adjustForReadiness(readiness({ armNeurologicalSymptoms: true }));
    expect(result.hardStopUpperBody).toBe(true);
    expect(result.reasons.join(" ")).toContain("stop");
  });

  it("riduce il volume del 30% per sonno 1/5", () => {
    const result = adjustForReadiness(readiness({ sleep: 1 }));
    expect(result.volumeMultiplier).toBe(0.7);
    expect(result.targetRir).toEqual([3, 4]);
  });

  it("programma il deload alla settimana 8", () => {
    const result = evaluateDeload(8, []);
    expect(result.scheduled).toBe(true);
    expect(result.volumeMultiplier).toBeLessThanOrEqual(0.6);
  });

  it("mantiene la domenica sempre libera", () => {
    expect(isSundayFree(new Date("2026-07-19T12:00:00"))).toBe(true);
  });

  it("non recupera una corsa saltata la domenica", () => {
    expect(rescheduleSkippedRun(new Date("2026-07-19T12:00:00"))).toBeNull();
  });

  it("limita al 10% la crescita del volume di corsa", () => {
    expect(capWeeklyRunMinutes(100, 125)).toBe(110);
    expect(capWeeklyRunMinutes(100, 105)).toBe(105);
  });

  it("annulla una decisione automatica e ripristina la prescrizione", () => {
    const progressed = evaluateExerciseProgression(exposure);
    const undone = undoProgressionDecision(progressed, "2026-07-14T10:00:00.000Z");
    expect(undone.decision.undoneAt).toBeTruthy();
    expect(undone.restoredPrescription).toEqual(prescription);
  });
});

describe("segnali clinici", () => {
  it("sostituisce a dolore 3/10 e interrompe oltre 3/10", () => {
    expect(evaluateExerciseProgression({ ...exposure, pain: 3 }).action).toBe("substitute");
    expect(evaluateExerciseProgression({ ...exposure, pain: 4 }).action).toBe("stop");
  });

  it("suggerisce deload anticipato solo dopo due sedute segnalate", () => {
    const one = evaluateDeload(5, [{ sessionRpe: 9 }]);
    const two = evaluateDeload(5, [{ sessionRpe: 9 }, { performanceDropPercent: 11 }]);
    expect(one.scheduled).toBe(false);
    expect(two.scheduled).toBe(true);
  });
});
