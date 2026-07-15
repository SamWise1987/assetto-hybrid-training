import { describe, expect, it } from "vitest";
import { externalWorkoutCanDriveSetProgression, externalWorkoutCountsForAdherence, isTemporalHealthDuplicate } from "./health-matching";
import type { ExternalWorkout } from "./types";

const base: ExternalWorkout = {
  id: "a", externalId: "native-a", source: "apple_health", platform: "ios",
  workoutType: "traditionalStrengthTraining", kind: "strength",
  startDate: "2026-07-13T17:00:00.000Z", endDate: "2026-07-13T18:00:00.000Z",
  durationMinutes: 60, importedAt: "2026-07-13T18:01:00.000Z",
};

describe("Health matching and deduplication", () => {
  it("deduplicates a native record with a changed id inside the safety window", () => {
    expect(isTemporalHealthDuplicate(base, { ...base, id: "b", externalId: "native-b", startDate: "2026-07-13T17:01:30.000Z", durationMinutes: 61 })).toBe(true);
    expect(isTemporalHealthDuplicate(base, { ...base, id: "c", externalId: "native-c", startDate: "2026-07-13T17:05:00.000Z" })).toBe(false);
  });

  it("counts manual matching for adherence without fabricating set progression", () => {
    const matched = { ...base, matchedTemplateId: "strength-a", matchedAt: "2026-07-13T18:02:00.000Z" };
    expect(externalWorkoutCountsForAdherence(matched)).toBe(true);
    expect(externalWorkoutCanDriveSetProgression(matched)).toBe(false);
  });
});
