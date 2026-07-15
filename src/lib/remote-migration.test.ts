import "fake-indexeddb/auto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: "test-token" } } })),
    },
  }),
  getOrCreateDeviceId: () => "device-migration-test",
  isSupabaseConfigured: () => true,
}));

vi.mock("./error-monitor", () => ({ reportAppError: vi.fn(async () => undefined) }));

let database: typeof import("./db");
let remoteSync: typeof import("./remote-sync");

describe("consent-safe local migration", () => {
  beforeAll(async () => {
    database = await import("./db");
    remoteSync = await import("./remote-sync");
  });

  beforeEach(async () => {
    await database.db.delete();
    await database.db.open();
    vi.unstubAllGlobals();
  });

  afterAll(() => database.db.close());

  it("non carica dati legacy e non chiude la migrazione prima del consenso", async () => {
    await database.seedInitialData({ name: "Profilo legacy" });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({ profile: { consent_accepted_at: null } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(remoteSync.migrateLocalDataForAccount("user-legacy")).resolves.toBe(false);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/me/onboarding");
    expect((await database.db.appSettings.get("app-settings"))?.localDataMigratedForUserId).toBeUndefined();
  });

  it("marca come conclusa una migrazione vuota senza inviare dati", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(remoteSync.migrateLocalDataForAccount("user-empty")).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
    expect((await database.db.appSettings.get("app-settings"))?.localDataMigratedForUserId).toBe("user-empty");
  });

  it("sincronizza i dati locali dopo un consenso confermato dal server", async () => {
    await database.seedInitialData({ name: "Profilo consenziente" });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url === "/api/sync/push") return new Response(JSON.stringify({ syncedAt: new Date().toISOString() }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url === "/api/me/onboarding") return new Response(JSON.stringify({ completedAt: new Date().toISOString() }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url === "/api/sync/normalized") return new Response(JSON.stringify({ synced: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 500, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(remoteSync.migrateLocalDataForAccount("user-consented", { consentAccepted: true })).resolves.toBe(true);

    const snapshotRequest = fetchMock.mock.calls.find(([input]) => String(input) === "/api/sync/push");
    expect(snapshotRequest).toBeDefined();
    expect(JSON.parse(String(snapshotRequest?.[1]?.body)).consent).toBe(true);
    expect((await database.db.appSettings.get("app-settings"))?.localDataMigratedForUserId).toBe("user-consented");
  });
});
