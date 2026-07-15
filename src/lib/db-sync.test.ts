import "fake-indexeddb/auto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ExternalWorkout } from "./types";

let database: typeof import("./db");

beforeAll(async () => {
  database = await import("./db");
});

const workout: ExternalWorkout = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  externalId: "native-1",
  source: "apple_health",
  platform: "ios",
  workoutType: "functionalStrengthTraining",
  kind: "strength",
  startDate: "2026-07-13T17:00:00.000Z",
  endDate: "2026-07-13T17:45:00.000Z",
  durationMinutes: 45,
  importedAt: "2026-07-13T18:00:00.000Z",
};

describe("offline normalized cache", () => {
  beforeEach(async () => {
    const { db } = database;
    await db.open();
    await db.transaction("rw", db.tables, async () => Promise.all(db.tables.map((table) => table.clear())));
  });

  afterAll(() => database.db.close());

  it("keeps one Health activity and queues it once", async () => {
    const { db, importExternalWorkout } = database;
    expect((await importExternalWorkout(workout)).imported).toBe(true);
    expect((await importExternalWorkout({ ...workout, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })).imported).toBe(false);
    expect(await db.externalWorkouts.count()).toBe(1);
    expect(await db.syncQueue.where("entity").equals("external_workout").count()).toBe(1);
  });

  it("preserves the account migration marker when onboarding seeds local tables", async () => {
    const { db, seedInitialData } = database;
    await db.appSettings.put({ id: "app-settings", aiCoachEnabled: false, aiModel: "gpt-4.1-mini", localDataMigratedForUserId: "user-1", dataOwnerUserId: "user-1" });
    await seedInitialData({ name: "Alex" });
    expect((await db.appSettings.get("app-settings"))?.localDataMigratedForUserId).toBe("user-1");
    expect((await db.appSettings.get("app-settings"))?.dataOwnerUserId).toBe("user-1");
  });

  it("never exposes or uploads the cache of a previous account", async () => {
    const { db, importExternalWorkout, prepareAccountCache, seedInitialData } = database;
    await seedInitialData({ name: "Primo account" });
    expect(await prepareAccountCache("user-1")).toBe("legacy");
    await db.accountProfiles.put({ id: "account-profile", userId: "user-1", email: "one@example.com", displayName: "One", role: "athlete", updatedAt: new Date().toISOString() });
    await importExternalWorkout(workout);

    expect(await prepareAccountCache("user-2")).toBe("switched-account");
    expect(await db.accountProfiles.count()).toBe(0);
    expect(await db.profiles.count()).toBe(0);
    expect(await db.externalWorkouts.count()).toBe(0);
    expect(await db.syncQueue.count()).toBe(0);
    expect((await db.appSettings.get("app-settings"))?.dataOwnerUserId).toBe("user-2");
    expect((await db.appSettings.get("app-settings"))?.localDataMigratedForUserId).toBeUndefined();
    expect(await db.runningWorkoutTemplates.count()).toBeGreaterThan(0);
  });

  it("mantiene solo l'ultima modifica profilo nella coda offline", async () => {
    const { db, enqueueSync } = database;
    await enqueueSync({ entity: "profile", entityId: "user-1", operation: "upsert", payload: { displayName: "Primo" } });
    await enqueueSync({ entity: "profile", entityId: "user-1", operation: "upsert", payload: { displayName: "Secondo" } });
    const queued = await db.syncQueue.where("entity").equals("profile").toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0].payload.displayName).toBe("Secondo");
  });

  it("mantiene una sola conferma di lettura per ogni notifica", async () => {
    const { db, enqueueSync } = database;
    await enqueueSync({ entity: "notification_read", entityId: "notice-1", operation: "upsert", payload: { readAt: "2026-07-15T10:00:00.000Z" } });
    await enqueueSync({ entity: "notification_read", entityId: "notice-1", operation: "upsert", payload: { readAt: "2026-07-15T10:01:00.000Z" } });
    await enqueueSync({ entity: "notification_read", entityId: "notice-2", operation: "upsert", payload: { readAt: "2026-07-15T10:02:00.000Z" } });

    const queued = await db.syncQueue.where("entity").equals("notification_read").sortBy("entityId");
    expect(queued).toHaveLength(2);
    expect(queued[0].payload.readAt).toBe("2026-07-15T10:01:00.000Z");
  });
});
