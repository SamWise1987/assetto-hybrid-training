import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRemoteUserProfile: vi.fn(),
  staffClient: vi.fn(),
}));

vi.mock("@/lib/supabase/profiles", () => ({
  getRemoteUserProfile: mocks.getRemoteUserProfile,
  staffClient: mocks.staffClient,
}));
vi.mock("@/lib/supabase/server", () => ({ createServiceSupabaseClient: vi.fn() }));
vi.mock("@/lib/push-server", () => ({ dispatchPush: vi.fn() }));

import { PATCH } from "./route";

const workoutId = "11111111-1111-4111-8111-111111111111";

function clientReturning(data: Record<string, unknown> | null) {
  const query = {
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };
  return { client: { from: vi.fn(() => query) }, query };
}

function matchRequest() {
  return new Request("http://localhost/api/external-workouts", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: workoutId, templateId: "strength-a" }),
  });
}

describe("PATCH /api/external-workouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRemoteUserProfile.mockResolvedValue({ userId: "athlete-id", role: "athlete" });
  });

  it("non dichiara abbinata un'attività inesistente o di un altro atleta", async () => {
    const { client } = clientReturning(null);
    mocks.staffClient.mockReturnValue(client);

    const response = await PATCH(matchRequest());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Attività non trovata." });
  });

  it("restituisce l'attività soltanto dopo un abbinamento persistito", async () => {
    const workout = { id: workoutId, matched_template_id: "strength-a", matched_at: "2026-07-15T12:00:00.000Z" };
    const { client, query } = clientReturning(workout);
    mocks.staffClient.mockReturnValue(client);

    const response = await PATCH(matchRequest());

    expect(response.status).toBe(200);
    expect(query.select).toHaveBeenCalledWith("id,matched_template_id,matched_at");
    await expect(response.json()).resolves.toEqual({ matched: true, workout });
  });
});
