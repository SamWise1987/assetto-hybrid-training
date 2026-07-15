import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRemoteUserProfile: vi.fn(),
  staffClient: vi.fn(),
  verifyActiveTrainerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/profiles", () => ({
  getRemoteUserProfile: mocks.getRemoteUserProfile,
  staffClient: mocks.staffClient,
  verifyActiveTrainerClient: mocks.verifyActiveTrainerClient,
}));
vi.mock("@/lib/supabase/server", () => ({ createServiceSupabaseClient: vi.fn() }));
vi.mock("@/lib/push-server", () => ({ dispatchPush: vi.fn() }));

import { GET, PATCH } from "./route";

const workoutId = "11111111-1111-4111-8111-111111111111";
const athleteId = "22222222-2222-4222-8222-222222222222";

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
    mocks.verifyActiveTrainerClient.mockResolvedValue({ allowed: true, error: null });
  });

  it("non espone i dettagli Health agli amministratori", async () => {
    mocks.getRemoteUserProfile.mockResolvedValue({ userId: "admin-id", role: "admin" });
    mocks.staffClient.mockReturnValue({ from: vi.fn() });

    const response = await GET(new Request(`http://localhost/api/external-workouts?userId=${athleteId}`));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "I dettagli Health non sono disponibili agli amministratori." });
  });

  it("non espone le attività del cliente di un altro trainer", async () => {
    mocks.getRemoteUserProfile.mockResolvedValue({ userId: "second-coach-id", role: "coach" });
    mocks.verifyActiveTrainerClient.mockResolvedValue({ allowed: false, error: null });
    mocks.staffClient.mockReturnValue({ from: vi.fn() });

    const response = await GET(new Request(`http://localhost/api/external-workouts?userId=${athleteId}`));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Cliente non assegnato a questo trainer." });
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
