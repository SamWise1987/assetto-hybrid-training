import { describe, expect, it } from "vitest";
import { countUniqueMatchedExternal } from "./adherence-dedupe";

describe("countUniqueMatchedExternal", () => {
  it("deduplica per data e template e rispetta la finestra", () => {
    expect(countUniqueMatchedExternal({
      fromDate: "2026-07-01",
      toDate: "2026-07-31",
      completedWorkouts: [{ date: "2026-07-10", templateId: "upper" }],
      matchedExternal: [
        { date: "2026-07-10", templateId: "upper" },
        { date: "2026-07-12", templateId: "lower" },
        { date: "2026-07-12", templateId: "lower" },
        { date: "2026-06-20", templateId: "lower" },
      ],
    })).toBe(1);
  });
});
