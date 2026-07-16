import { describe, expect, it } from "vitest";
import { hasStrengthTemplate } from "./health-matching-server";

describe("hasStrengthTemplate", () => {
  it("accetta soltanto una scheda di forza del piano", () => {
    const sessions = [
      { templateId: "strength-a", kind: "strength" },
      { templateId: "run-a", kind: "run" },
    ];

    expect(hasStrengthTemplate(sessions, "strength-a")).toBe(true);
    expect(hasStrengthTemplate(sessions, "run-a")).toBe(false);
    expect(hasStrengthTemplate(sessions, "missing")).toBe(false);
  });

  it("rifiuta snapshot del piano non validi", () => {
    expect(hasStrengthTemplate(null, "strength-a")).toBe(false);
    expect(hasStrengthTemplate([{ templateId: "strength-a" }, "invalid"], "strength-a")).toBe(false);
  });
});
