import { describe, expect, it } from "vitest";
import { localDateKey } from "./local-date";

describe("localDateKey", () => {
  it("mantiene il giorno del calendario del dispositivo a mezzanotte locale", () => {
    expect(localDateKey(new Date(2026, 7, 3, 0, 5))).toBe("2026-08-03");
  });

  it("aggiunge gli zeri a mese e giorno", () => {
    expect(localDateKey(new Date(2026, 0, 4, 12))).toBe("2026-01-04");
  });
});
