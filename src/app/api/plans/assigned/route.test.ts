import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRemoteUserProfile: vi.fn(),
  staffClient: vi.fn(),
  mapRemotePlan: vi.fn((row: { id: string; name: string }) => ({ id: row.id, name: row.name })),
  createServiceSupabaseClient: vi.fn(),
  dispatchPush: vi.fn(),
}));

vi.mock("@/lib/supabase/profiles", () => ({
  getRemoteUserProfile: mocks.getRemoteUserProfile,
  staffClient: mocks.staffClient,
  mapRemotePlan: mocks.mapRemotePlan,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceSupabaseClient: mocks.createServiceSupabaseClient,
}));
vi.mock("@/lib/push-server", () => ({ dispatchPush: mocks.dispatchPush }));

import { GET } from "./route";

function queryResult<T>(data: T) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
    single: vi.fn(async () => ({ data, error: null })),
  };
  return query;
}

describe("GET /api/plans/assigned", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRemoteUserProfile.mockResolvedValue({
      userId: "athlete-id",
      email: "athlete@example.com",
      role: "athlete",
    });
    mocks.dispatchPush.mockResolvedValue({ sent: 1 });
  });

  it("crea una sola notifica al primo recupero di un piano assegnato prima dell'attivazione", async () => {
    const assignment = {
      id: "assignment-id",
      plan_id: "plan-id",
      athlete_email: "athlete@example.com",
      assigned_by: "coach-id",
      assigned_at: "2026-07-15T08:00:00.000Z",
      active: true,
    };
    const plan = { id: "plan-id", name: "Piano Hybrid", sessions: [] };
    mocks.staffClient.mockReturnValue({
      from: vi.fn((table: string) => table === "plan_assignments"
        ? queryResult(assignment)
        : table === "training_plans"
          ? queryResult(plan)
          : queryResult({ version: 2, reason: "Più recupero tra le sedute", created_at: "2026-07-15T09:00:00.000Z" })),
    });

    const upsert = vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: { recipient_user_id: "athlete-id" }, error: null })),
      })),
    }));
    mocks.createServiceSupabaseClient.mockReturnValue({
      from: vi.fn(() => ({ upsert })),
    });

    const response = await GET(new Request("http://localhost/api/plans/assigned", {
      headers: { Authorization: "Bearer token" },
    }));

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      recipient_user_id: "athlete-id",
      actor_user_id: "coach-id",
      type: "plan_assigned",
      body: "Il trainer ti ha assegnato “Piano Hybrid”.",
      dedupe_key: "athlete-id:plan_assigned:plan-id:assignment-id",
    }), { onConflict: "dedupe_key", ignoreDuplicates: true });
    expect(mocks.dispatchPush).toHaveBeenCalledWith(["athlete-id"], {
      title: "Nuovo piano disponibile",
      body: "Il trainer ti ha assegnato “Piano Hybrid”.",
      href: "/?tab=today",
    });
    await expect(response.clone().json()).resolves.toMatchObject({
      plan: { id: "plan-id", version: 2, changeReason: "Più recupero tra le sedute" },
      planVersion: { version: 2, reason: "Più recupero tra le sedute" },
    });
  });

  it("non reinvia la push quando la notifica idempotente esiste già", async () => {
    mocks.staffClient.mockReturnValue({
      from: vi.fn((table: string) => table === "plan_assignments"
        ? queryResult({ id: "assignment-id", plan_id: "plan-id", athlete_email: "athlete@example.com", assigned_by: "coach-id", assigned_at: "2026-07-15T08:00:00.000Z", active: true })
        : table === "training_plans"
          ? queryResult({ id: "plan-id", name: "Piano Hybrid", sessions: [] })
          : queryResult({ version: 1, reason: "Creazione piano", created_at: "2026-07-15T08:00:00.000Z" })),
    });
    mocks.createServiceSupabaseClient.mockReturnValue({
      from: vi.fn(() => ({
        upsert: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })),
      })),
    });

    const response = await GET(new Request("http://localhost/api/plans/assigned", {
      headers: { Authorization: "Bearer token" },
    }));

    expect(response.status).toBe(200);
    expect(mocks.dispatchPush).not.toHaveBeenCalled();
  });
});
