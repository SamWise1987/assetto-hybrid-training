import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./remote-sync", () => ({ getRemoteAccessToken: vi.fn(async () => "test-token") }));

const { db } = await import("./db");
const { syncAssignedPlanFromCloud } = await import("./plan-sync");

const assignment = {
  id: "assignment-1",
  planId: "plan-1",
  athleteEmail: "athlete@example.com",
  athleteUserId: "athlete-1",
  assignedBy: "coach-1",
  assignedAt: "2026-07-14T08:00:00.000Z",
  active: true,
};

function plan(updatedAt: string, version: number, reason: string) {
  return {
    id: "plan-1",
    name: "Piano Hybrid",
    description: `Versione ${version}`,
    sessions: [],
    runSessions: [],
    createdBy: "coach-1",
    createdAt: "2026-07-14T08:00:00.000Z",
    updatedAt,
    version,
    changeReason: reason,
  };
}

function responseBody(updatedAt: string, version: number, reason: string) {
  return {
    assignment,
    plan: plan(updatedAt, version, reason),
    planVersion: { version, reason, createdAt: updatedAt },
  };
}

describe("syncAssignedPlanFromCloud", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.delete();
  });

  it("distingue una nuova assegnazione da una versione successiva dello stesso piano", async () => {
    const bodies = [
      responseBody("2026-07-14T08:00:00.000Z", 1, "Piano iniziale"),
      responseBody("2026-07-15T08:00:00.000Z", 2, "Più recupero tra le sedute"),
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(bodies.shift()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));

    await expect(syncAssignedPlanFromCloud()).resolves.toMatchObject({
      isNew: true,
      isUpdated: false,
      change: "assigned",
      reason: "Piano iniziale",
    });
    await expect(syncAssignedPlanFromCloud()).resolves.toMatchObject({
      isNew: false,
      isUpdated: true,
      change: "updated",
      reason: "Più recupero tra le sedute",
    });

    await expect(db.trainingPlans.get("plan-1")).resolves.toMatchObject({
      version: 2,
      description: "Versione 2",
      changeReason: "Più recupero tra le sedute",
    });
  });

  it("non mostra un nuovo avviso quando la versione cloud è già in cache", async () => {
    await db.trainingPlans.put(plan("2026-07-15T08:00:00.000Z", 2, "Più recupero tra le sedute"));
    await db.planAssignments.put(assignment);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(
      responseBody("2026-07-15T08:00:00.000Z", 2, "Più recupero tra le sedute"),
    ), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(syncAssignedPlanFromCloud()).resolves.toMatchObject({
      isNew: false,
      isUpdated: false,
      change: null,
    });
  });

  it("arricchisce una cache legacy senza presentare come nuovo un piano invariato", async () => {
    const legacyPlan = { ...plan("2026-07-15T08:00:00.000Z", 2, "Più recupero tra le sedute"), version: undefined, changeReason: undefined };
    await db.trainingPlans.put(legacyPlan);
    await db.planAssignments.put(assignment);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(
      responseBody("2026-07-15T08:00:00.000Z", 2, "Più recupero tra le sedute"),
    ), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(syncAssignedPlanFromCloud()).resolves.toMatchObject({
      isNew: false,
      isUpdated: false,
      change: null,
    });
    await expect(db.trainingPlans.get("plan-1")).resolves.toMatchObject({ version: 2 });
  });
});
