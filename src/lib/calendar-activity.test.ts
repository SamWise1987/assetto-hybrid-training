import { describe, expect, it } from "vitest";
import { isScheduledTemplateComplete, matchedExternalForTemplateDate } from "./calendar-activity";

describe("calendar activity attribution", () => {
  const date = "2026-07-16";

  it("non completa una scheda di forza con una corsa dello stesso giorno", () => {
    expect(isScheduledTemplateComplete({
      date,
      template: { id: "upper", kind: "strength" },
      sessions: [],
      runs: [{ date, status: "complete" }],
      externalWorkouts: [],
    })).toBe(false);
  });

  it("richiede lo stesso template per log app e attività Health", () => {
    const externalWorkouts = [{ startDate: `${date}T08:00:00.000Z`, matchedTemplateId: "lower" }];
    expect(isScheduledTemplateComplete({
      date,
      template: { id: "upper", kind: "strength" },
      sessions: [{ date, templateId: "lower", status: "complete" }],
      runs: [],
      externalWorkouts,
    })).toBe(false);
    expect(matchedExternalForTemplateDate(externalWorkouts, date, "upper")).toBeUndefined();
  });

  it("completa la seduta quando data, tipo e template coincidono", () => {
    expect(isScheduledTemplateComplete({
      date,
      template: { id: "upper", kind: "strength" },
      sessions: [],
      runs: [],
      externalWorkouts: [{ startDate: `${date}T08:00:00.000Z`, matchedTemplateId: "upper" }],
    })).toBe(true);
  });
});
