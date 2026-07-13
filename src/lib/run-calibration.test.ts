import { describe, expect, it } from "vitest";
import { calibrateSaturdayRun, defaultRunPlanForDay, sumRunMinutes } from "./run-calibration";
import type { RunSession } from "./types";

const tuesdayRun = (overrides: Partial<RunSession> = {}): RunSession => ({
  id: "run-tue",
  date: "2026-07-14",
  type: "easy",
  status: "complete",
  durationMinutes: 30,
  rpe: 3,
  talkTest: "full-sentences",
  symptomsDuring: 0,
  ...overrides,
});

const context = {
  weekNumber: 4,
  previousWeekTotalMinutes: 88,
  runsEasyOnly: false,
};

describe("calibrazione corsa", () => {
  it("recupera parzialmente se martedì è corto ma facile", () => {
    const decision = calibrateSaturdayRun({
      tuesdayPlanned: { durationMinutes: 50, type: "easy" },
      tuesdayActual: tuesdayRun({ durationMinutes: 30, rpe: 3 }),
      saturdayOriginal: { durationMinutes: 55, type: "long-easy" },
      context,
      targetDate: "2026-07-18",
    });

    expect(decision.rule).toBe("PARTIAL_CATCHUP_SMART");
    expect(decision.outputPlan.durationMinutes).toBeGreaterThan(55);
    expect(decision.outputPlan.durationMinutes).toBeLessThanOrEqual(97);
  });

  it("non recupera aggressivamente con RPE alto", () => {
    const decision = calibrateSaturdayRun({
      tuesdayPlanned: { durationMinutes: 50, type: "easy" },
      tuesdayActual: tuesdayRun({ durationMinutes: 30, rpe: 7 }),
      saturdayOriginal: { durationMinutes: 55, type: "controlled-quality" },
      context,
      targetDate: "2026-07-18",
    });

    expect(decision.rule).toBe("LARGE_SHORTFALL_NO_AGGRESSIVE_CATCHUP");
    expect(decision.outputPlan.durationMinutes).toBeLessThan(55);
    expect(decision.outputPlan.type).not.toBe("controlled-quality");
  });

  it("converte sabato in facile con sintomi", () => {
    const decision = calibrateSaturdayRun({
      tuesdayPlanned: { durationMinutes: 50, type: "easy" },
      tuesdayActual: tuesdayRun({ symptomsDuring: 4, status: "stopped" }),
      saturdayOriginal: { durationMinutes: 55, type: "controlled-quality" },
      context,
      targetDate: "2026-07-18",
    });

    expect(decision.outputPlan.type).toBe("easy");
    expect(decision.rule).toBe("SYMPTOMS_OR_HIGH_RPE");
  });

  it("mantiene il tipo del sabato e rispetta il tetto settimanale", () => {
    const decision = calibrateSaturdayRun({
      tuesdayPlanned: { durationMinutes: 50, type: "easy" },
      tuesdayActual: tuesdayRun({ durationMinutes: 50, rpe: 4 }),
      saturdayOriginal: { durationMinutes: 55, type: "long-easy" },
      context,
      targetDate: "2026-07-18",
    });

    expect(decision.rule).toBe("TUESDAY_ON_PLAN");
    expect(decision.outputPlan.type).toBe("long-easy");
    expect(decision.outputPlan.durationMinutes).toBe(45);
  });

  it("genera piani predefiniti per martedì e sabato", () => {
    const tuesday = defaultRunPlanForDay(4, 2, "2026-07-14");
    const saturday = defaultRunPlanForDay(4, 6, "2026-07-18");
    expect(tuesday?.durationMinutes).toBe(50);
    expect(saturday?.type).toBe("long-easy");
  });

  it("somma i minuti di corsa", () => {
    expect(sumRunMinutes([{ durationMinutes: 30 }, { durationMinutes: 48 }])).toBe(78);
  });
});
