import { describe, expect, it } from "vitest";
import { undoRunCalibrationDecision } from "./run-calibration";
import type { RunCalibrationDecision } from "./types";

const sampleDecision: RunCalibrationDecision = {
  id: "cal-1",
  date: "2026-07-08",
  targetDate: "2026-07-12",
  targetDayOfWeek: 6,
  rule: "PARTIAL_CATCHUP_SMART",
  reason: "Test",
  inputs: {},
  previousPlan: { type: "long-easy", durationMinutes: 55 },
  outputPlan: { type: "long-easy", durationMinutes: 60 },
};

describe("undoRunCalibrationDecision", () => {
  it("marks decision undone and restores previous plan", () => {
    const result = undoRunCalibrationDecision(sampleDecision, "2026-07-13T10:00:00.000Z");
    expect(result.decision.undoneAt).toBe("2026-07-13T10:00:00.000Z");
    expect(result.restoredPlan).toEqual(sampleDecision.previousPlan);
  });
});
