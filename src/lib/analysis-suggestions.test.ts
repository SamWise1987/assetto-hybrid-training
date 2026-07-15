import { describe, expect, it } from "vitest";
import { applySuggestionToPlan, canTransitionSuggestion } from "./analysis-suggestions";

describe("analysis suggestion lifecycle", () => {
  it("allows reviewed transitions and prevents reopening a closed suggestion", () => {
    expect(canTransitionSuggestion("proposed", "approved")).toBe(true);
    expect(canTransitionSuggestion("approved", "applied")).toBe(true);
    expect(canTransitionSuggestion("applied", "undone")).toBe(true);
    expect(canTransitionSuggestion("rejected", "applied")).toBe(false);
  });

  it("applies a bounded running duration change without mutating the original", () => {
    const plan = { name: "Piano", description: null, sessions: [{ templateId: "run", dayOfWeek: 2, displayName: "Corsa", kind: "run" as const, estimatedMinutes: 40, runConfig: { type: "easy" as const, durationMinutes: 40 } }] };
    const changed = applySuggestionToPlan(plan, { runDurationPercent: 50, planDescription: "Volume rivisto" });
    expect(changed.sessions[0].runConfig?.durationMinutes).toBe(52);
    expect(changed.description).toBe("Volume rivisto");
    expect(plan.sessions[0].runConfig?.durationMinutes).toBe(40);
  });
});
