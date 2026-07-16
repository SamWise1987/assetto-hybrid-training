import { describe, expect, it } from "vitest";
import type { HealthSyncState } from "./types";
import { shouldRunNativeHealthSync } from "./native-health-schedule";

const now = Date.parse("2026-07-16T12:00:00.000Z");

function state(overrides: Partial<HealthSyncState> = {}): HealthSyncState {
  return {
    id: "health-ios",
    platform: "ios",
    status: "success",
    lastAttemptAt: "2026-07-16T11:40:00.000Z",
    lastSuccessfulSyncAt: "2026-07-16T11:40:00.000Z",
    lastImportedCount: 0,
    lastSkippedCount: 0,
    ...overrides,
  };
}

describe("native Health foreground schedule", () => {
  it("sincronizza subito al ritorno in foreground", () => {
    expect(shouldRunNativeHealthSync(state({ lastSuccessfulSyncAt: "2026-07-16T11:59:00.000Z" }), true, now)).toBe(true);
  });

  it("non ripete un sync ancora realmente in corso", () => {
    expect(shouldRunNativeHealthSync(state({ status: "syncing", lastAttemptAt: "2026-07-16T11:58:00.000Z" }), true, now)).toBe(false);
  });

  it("recupera un sync rimasto sospeso dopo la chiusura dell'app", () => {
    expect(shouldRunNativeHealthSync(state({ status: "syncing", lastAttemptAt: "2026-07-16T11:40:00.000Z" }), false, now)).toBe(true);
  });

  it("rispetta diniego e intervallo minimo in background", () => {
    expect(shouldRunNativeHealthSync(state({ status: "denied" }), true, now)).toBe(false);
    expect(shouldRunNativeHealthSync(state({ lastSuccessfulSyncAt: "2026-07-16T11:50:00.000Z" }), false, now)).toBe(false);
  });
});
