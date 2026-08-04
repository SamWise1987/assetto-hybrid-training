import { describe, expect, it } from "vitest";
import { buildTrainerSourceFreshness } from "./trainer-analysis-summary";

describe("buildTrainerSourceFreshness", () => {
  it("distingue le fonti e non duplica un'attività Health normalizzata", () => {
    const result = buildTrainerSourceFreshness({
      calendar: [
        { id: "health-1", date: "2026-07-15", kind: "run", source: "apple_health", status: "complete", label: "Corsa" },
        { id: "web-1", date: "2026-07-14", kind: "strength", source: "web", status: "complete", label: "Forza A" },
      ],
      external: [
        { id: "health-1", kind: "run", source: "apple_health", start_date: "2026-07-15T08:00:00.000Z" },
      ],
    });

    expect(result).toEqual([
      {
        source: "apple_health",
        count: 1,
        latestAt: "2026-07-15T08:00:00.000Z",
        quality: "Dati Apple Health; la forza non include serie inventate",
      },
      {
        source: "web",
        count: 1,
        latestAt: "2026-07-14T12:00:00.000Z",
        quality: "Registrazione effettuata dalla webapp",
      },
    ]);
  });

  it("raggruppa più attività della stessa fonte usando la più recente", () => {
    const result = buildTrainerSourceFreshness({
      calendar: [
        { id: "app-1", date: "2026-07-10", kind: "strength", source: "app", status: "complete", label: "A" },
        { id: "app-2", date: "2026-07-12", kind: "strength", source: "app", status: "complete", label: "B" },
      ],
      external: [],
    });

    expect(result).toMatchObject([{ source: "app", count: 2, latestAt: "2026-07-12T12:00:00.000Z" }]);
  });
});
