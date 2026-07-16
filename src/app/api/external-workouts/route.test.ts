import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRemoteUserProfile: vi.fn(),
  staffClient: vi.fn(),
  verifyActiveTrainerClient: vi.fn(),
  verifyActiveStrengthTemplate: vi.fn(),
  notifyTrainersOfExternalWorkouts: vi.fn(),
}));

vi.mock("@/lib/supabase/profiles", () => ({
  getRemoteUserProfile: mocks.getRemoteUserProfile,
  staffClient: mocks.staffClient,
  verifyActiveTrainerClient: mocks.verifyActiveTrainerClient,
}));
vi.mock("@/lib/supabase/server", () => ({ createServiceSupabaseClient: vi.fn() }));
vi.mock("@/lib/push-server", () => ({ dispatchPush: vi.fn() }));
vi.mock("@/lib/health-matching-server", () => ({ verifyActiveStrengthTemplate: mocks.verifyActiveStrengthTemplate }));
vi.mock("@/lib/trainer-activity-notifications", () => ({ notifyTrainersOfExternalWorkouts: mocks.notifyTrainersOfExternalWorkouts }));

import { GET, PATCH, POST } from "./route";

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

function matchingClient(workout: Record<string, unknown>, matched: Record<string, unknown>) {
  const query = {
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    maybeSingle: vi.fn()
      .mockResolvedValueOnce({ data: workout, error: null })
      .mockResolvedValueOnce({ data: matched, error: null }),
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

function importedWorkout(id: string, startDate: string) {
  return {
    id,
    externalId: `health-${id}`,
    source: "apple_health",
    platform: "ios",
    workoutType: "functionalStrengthTraining",
    kind: "strength",
    startDate,
    endDate: new Date(Date.parse(startDate) + 45 * 60_000).toISOString(),
    durationMinutes: 45,
    sourceName: "Apple Watch",
    importedAt: "2026-07-16T10:00:00.000Z",
  };
}

describe("PATCH /api/external-workouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRemoteUserProfile.mockResolvedValue({ userId: "athlete-id", role: "athlete" });
    mocks.verifyActiveTrainerClient.mockResolvedValue({ allowed: true, error: null });
    mocks.verifyActiveStrengthTemplate.mockResolvedValue({ allowed: true });
    mocks.notifyTrainersOfExternalWorkouts.mockResolvedValue({ notified: 1 });
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
    const { client, query } = matchingClient({ id: workoutId, kind: "strength" }, workout);
    mocks.staffClient.mockReturnValue(client);

    const response = await PATCH(matchRequest());

    expect(response.status).toBe(200);
    expect(query.select).toHaveBeenCalledWith("id,matched_template_id,matched_at");
    await expect(response.json()).resolves.toEqual({ matched: true, workout });
  });

  it("rifiuta una scheda che non appartiene al piano attivo", async () => {
    const { client } = matchingClient({ id: workoutId, kind: "strength" }, {});
    mocks.staffClient.mockReturnValue(client);
    mocks.verifyActiveStrengthTemplate.mockResolvedValue({ allowed: false, reason: "invalid_template" });

    const response = await PATCH(matchRequest());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "La scheda scelta non appartiene al tuo piano di forza attivo." });
  });

  it("rifiuta l'abbinamento di una corsa a una scheda di forza", async () => {
    const { client } = matchingClient({ id: workoutId, kind: "run" }, {});
    mocks.staffClient.mockReturnValue(client);

    const response = await PATCH(matchRequest());

    expect(response.status).toBe(400);
    expect(mocks.verifyActiveStrengthTemplate).not.toHaveBeenCalled();
  });

  it("notifica soltanto le attività nella finestra incrementale Health", async () => {
    const recentId = "33333333-3333-4333-8333-333333333333";
    const oldId = "44444444-4444-4444-8444-444444444444";
    const previousStateQuery = {
      select: vi.fn(() => previousStateQuery),
      eq: vi.fn(() => previousStateQuery),
      maybeSingle: vi.fn(async () => ({ data: { last_successful_sync_at: "2026-07-15T10:00:00.000Z" }, error: null })),
      upsert: vi.fn(async () => ({ error: null })),
    };
    const workoutUpsert = vi.fn(async () => ({ error: null }));
    mocks.staffClient.mockReturnValue({
      from: vi.fn((table: string) => table === "health_sync_states" ? previousStateQuery : { upsert: workoutUpsert }),
    });

    const response = await POST(new Request("http://localhost/api/external-workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workouts: [
          importedWorkout(recentId, "2026-07-14T10:00:00.000Z"),
          importedWorkout(oldId, "2026-07-10T10:00:00.000Z"),
        ],
        healthState: {
          platform: "ios",
          status: "success",
          lastAttemptAt: "2026-07-16T10:00:00.000Z",
          lastSuccessfulSyncAt: "2026-07-16T10:00:00.000Z",
          imported: 1,
          skipped: 1,
        },
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.notifyTrainersOfExternalWorkouts).toHaveBeenCalledWith("athlete-id", [recentId]);
  });
});
