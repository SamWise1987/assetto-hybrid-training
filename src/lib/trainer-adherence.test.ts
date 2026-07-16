import { describe, expect, it } from "vitest";
import { calculateTrainerAdherence } from "./trainer-adherence";

describe("calculateTrainerAdherence", () => {
  it("calcola l'aderenza soltanto sulle ultime quattro settimane", () => {
    const result = calculateTrainerAdherence({
      now: Date.parse("2026-07-15T12:00:00.000Z"),
      plannedPerWeek: 2,
      workouts: [
        { date: "2026-07-14", status: "complete", templateId: "strength-a" },
        { date: "2026-06-10", status: "complete" },
        { date: "2026-07-12", status: "stopped" },
      ],
      runs: [{ date: "2026-07-01", status: "complete" }],
      matchedExternal: [
        { date: "2026-07-10", templateId: "strength-a" },
        { date: "2026-05-01", templateId: "strength-a" },
      ],
      followUpDates: ["2026-07-14", "2026-05-01"],
    });

    expect(result).toMatchObject({
      cutoff: "2026-06-17",
      workoutCount: 1,
      runCount: 1,
      matchedExternalCount: 1,
      followUpCount: 1,
      completed: 3,
      percent: 38,
    });
  });

  it("limita la percentuale al 100%", () => {
    const recent = Array.from({ length: 6 }, (_, index) => ({ date: `2026-07-${String(index + 1).padStart(2, "0")}`, status: "complete" }));
    expect(calculateTrainerAdherence({
      now: Date.parse("2026-07-15T12:00:00.000Z"),
      plannedPerWeek: 1,
      workouts: recent,
      runs: [],
      matchedExternal: [],
    }).percent).toBe(100);
  });

  it("non conta due volte una scheda registrata anche da Apple Health", () => {
    const result = calculateTrainerAdherence({
      now: Date.parse("2026-07-15T12:00:00.000Z"),
      plannedPerWeek: 2,
      workouts: [{ date: "2026-07-14", status: "complete", templateId: "strength-a" }],
      runs: [],
      matchedExternal: [
        { date: "2026-07-14", templateId: "strength-a" },
        { date: "2026-07-14", templateId: "strength-a" },
        { date: "2026-07-14", templateId: "strength-b" },
      ],
    });

    expect(result).toMatchObject({ workoutCount: 1, matchedExternalCount: 1, completed: 2, percent: 25 });
  });
});
