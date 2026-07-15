import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./remote-sync", () => ({
  getRemoteAccessToken: vi.fn(async () => "test-token"),
  syncAccountProfile: vi.fn(async () => null),
}));

vi.mock("./error-monitor", () => ({
  reportAppError: vi.fn(async () => undefined),
}));

const { db } = await import("./db");
const { flushSyncQueue } = await import("./normalized-sync");

describe("normalized offline sync", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.delete();
  });

  it("svuota automaticamente code più grandi di un singolo batch", async () => {
    await db.syncQueue.bulkAdd(Array.from({ length: 205 }, (_, index) => ({
      id: `queue-${String(index).padStart(3, "0")}`,
      entity: "workout" as const,
      entityId: `workout-${index}`,
      operation: "upsert" as const,
      payload: { id: `workout-${index}` },
      createdAt: new Date(1_700_000_000_000 + index).toISOString(),
      attemptCount: 0,
    })));
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({ synced: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(flushSyncQueue()).resolves.toBe(205);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(await db.syncQueue.count()).toBe(0);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).items).toHaveLength(100);
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body)).items).toHaveLength(5);
  });

  it("conserva la coda sul dispositivo quando la rete è assente", async () => {
    await db.syncQueue.add({
      id: "queue-offline",
      entity: "run",
      entityId: "run-offline",
      operation: "upsert",
      payload: { id: "run-offline" },
      createdAt: new Date().toISOString(),
      attemptCount: 0,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("navigator", { onLine: false });
    vi.stubGlobal("fetch", fetchMock);

    await expect(flushSyncQueue()).resolves.toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await db.syncQueue.count()).toBe(1);
  });

  it("sincronizza una lettura fatta offline quando torna la rete", async () => {
    await db.syncQueue.add({
      id: "queue-notification",
      entity: "notification_read",
      entityId: "notice-offline",
      operation: "upsert",
      payload: { readAt: "2026-07-15T12:00:00.000Z" },
      createdAt: new Date().toISOString(),
      attemptCount: 0,
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({ synced: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("navigator", { onLine: false });
    vi.stubGlobal("fetch", fetchMock);
    await expect(flushSyncQueue()).resolves.toBe(0);
    expect(await db.syncQueue.count()).toBe(1);

    vi.stubGlobal("navigator", { onLine: true });
    await expect(flushSyncQueue()).resolves.toBe(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).items[0]).toEqual({
      entity: "notification_read",
      entityId: "notice-offline",
      payload: { readAt: "2026-07-15T12:00:00.000Z" },
    });
    expect(await db.syncQueue.count()).toBe(0);
  });
});
