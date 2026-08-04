import { describe, expect, it } from "vitest";
import { isSyncItemAllowedForRole } from "./sync-scope";

describe("sync scope per ruolo", () => {
  it("mantiene tutte le modifiche dell'atleta sincronizzabili", () => {
    expect(isSyncItemAllowedForRole({ entity: "run" }, "athlete")).toBe(true);
    expect(isSyncItemAllowedForRole({ entity: "external_workout" }, "athlete")).toBe(true);
  });

  it("limita lo staff a profilo e letture inbox senza cancellare la coda atleta", () => {
    expect(isSyncItemAllowedForRole({ entity: "profile" }, "admin")).toBe(true);
    expect(isSyncItemAllowedForRole({ entity: "notification_read" }, "coach")).toBe(true);
    expect(isSyncItemAllowedForRole({ entity: "run" }, "admin")).toBe(false);
    expect(isSyncItemAllowedForRole({ entity: "external_workout" }, "coach")).toBe(false);
  });
});
