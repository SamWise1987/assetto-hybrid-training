import { describe, expect, it } from "vitest";
import { formatPreciseDuration } from "./duration";
import { TRAINING_GLOSSARY } from "./glossary";

describe("formatPreciseDuration", () => {
  it("formats minutes and seconds", () => {
    expect(formatPreciseDuration(0)).toBe("0:00");
    expect(formatPreciseDuration(65_000)).toBe("1:05");
    expect(formatPreciseDuration(3_661_000)).toBe("1:01:01");
  });
});

describe("glossary", () => {
  it("explains RIR and RPE", () => {
    const acronyms = TRAINING_GLOSSARY.map((entry) => entry.acronym);
    expect(acronyms).toContain("RIR");
    expect(acronyms).toContain("RPE");
    expect(acronyms).toContain("ROM");
  });
});
