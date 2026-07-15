import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  staffClient: vi.fn(),
  mapRemotePlan: vi.fn((row: Record<string, unknown>) => ({
    id: row.id,
    name: row.name,
    sessions: row.sessions,
  })),
  dispatchPush: vi.fn(),
}));

vi.mock("@/lib/supabase/profiles", () => ({
  requireStaff: mocks.requireStaff,
  staffClient: mocks.staffClient,
  mapRemotePlan: mocks.mapRemotePlan,
}));
vi.mock("@/lib/push-server", () => ({ dispatchPush: mocks.dispatchPush }));

import { PATCH } from "./route";

const planId = "33333333-3333-4333-8333-333333333333";

describe("PATCH /api/plans/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaff.mockResolvedValue({ userId: "coach-id", role: "coach" });
  });

  it("versiona la motivazione nell'inbox mantenendo generica la push", async () => {
    const planRow = { id: planId, name: "Piano Hybrid", description: "Aggiornato", sessions: [], created_by: "coach-id" };
    const trainingQuery = {
      update: vi.fn(() => trainingQuery),
      eq: vi.fn(() => trainingQuery),
      select: vi.fn(() => trainingQuery),
      single: vi.fn(async () => ({ data: planRow, error: null })),
    };
    const versionInsert = vi.fn(async () => ({ error: null }));
    const versionQuery = {
      select: vi.fn(() => versionQuery),
      eq: vi.fn(() => versionQuery),
      order: vi.fn(() => versionQuery),
      limit: vi.fn(() => versionQuery),
      maybeSingle: vi.fn(async () => ({ data: { version: 1 }, error: null })),
      insert: versionInsert,
    };
    let assignmentEqCalls = 0;
    const assignmentQuery = {
      select: vi.fn(() => assignmentQuery),
      eq: vi.fn(() => {
        assignmentEqCalls += 1;
        return assignmentEqCalls === 2
          ? Promise.resolve({ data: [{ athlete_user_id: "athlete-id" }], error: null })
          : assignmentQuery;
      }),
    };
    const notificationUpsert = vi.fn(() => ({
      select: vi.fn(async () => ({ data: [{ recipient_user_id: "athlete-id" }], error: null })),
    }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    mocks.staffClient.mockReturnValue({
      from: vi.fn((table: string) => table === "training_plans"
        ? trainingQuery
        : table === "plan_versions"
          ? versionQuery
          : table === "plan_assignments"
            ? assignmentQuery
            : table === "app_notifications"
              ? { upsert: notificationUpsert }
              : { insert: auditInsert }),
    });

    const reason = "Più recupero tra le sedute dopo la settimana recente.";
    const response = await PATCH(new Request(`http://localhost/api/plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: JSON.stringify({ name: "Piano Hybrid", sessions: [], reason }),
    }), { params: Promise.resolve({ id: planId }) });

    expect(response.status).toBe(200);
    expect(versionInsert).toHaveBeenCalledWith(expect.objectContaining({ version: 2, reason }));
    expect(notificationUpsert).toHaveBeenCalledWith([
      expect.objectContaining({
        type: "plan_updated",
        body: `Il trainer ha pubblicato una nuova versione del programma. Motivo: ${reason}`,
        dedupe_key: `athlete-id:plan_updated:${planId}:2`,
      }),
    ], { onConflict: "dedupe_key", ignoreDuplicates: true });
    expect(mocks.dispatchPush).toHaveBeenCalledWith(["athlete-id"], {
      title: "Il tuo piano è stato aggiornato",
      body: "Il trainer ha pubblicato una nuova versione del programma.",
      href: "/?tab=today",
    });
    await expect(response.json()).resolves.toMatchObject({ version: 2, reason, plan: { version: 2, changeReason: reason } });
  });
});
