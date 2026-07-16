import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceSupabaseClient: vi.fn(),
  dispatchPush: vi.fn(),
}));

vi.mock("./supabase/server", () => ({ createServiceSupabaseClient: mocks.createServiceSupabaseClient }));
vi.mock("./push-server", () => ({ dispatchPush: mocks.dispatchPush }));

import { notifyTrainersOfExternalWorkouts } from "./trainer-activity-notifications";

describe("notifyTrainersOfExternalWorkouts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("crea un solo evento per trainer e attività e invia una push priva di dati sanitari", async () => {
    const relationshipsQuery = {
      select: vi.fn(() => relationshipsQuery),
      eq: vi.fn(() => relationshipsQuery),
      then: (resolve: (value: unknown) => unknown) => resolve({
        data: [{ trainer_user_id: "trainer-1" }, { trainer_user_id: "trainer-1" }],
        error: null,
      }),
    };
    const notificationSelect = vi.fn(async () => ({ data: [{ recipient_user_id: "trainer-1" }], error: null }));
    const notificationUpsert = vi.fn(() => ({ select: notificationSelect }));
    mocks.createServiceSupabaseClient.mockReturnValue({
      from: vi.fn((table: string) => table === "trainer_clients"
        ? relationshipsQuery
        : { upsert: notificationUpsert }),
    });

    const result = await notifyTrainersOfExternalWorkouts("athlete-1", ["workout-1", "workout-1"]);

    expect(result).toEqual({ notified: 1 });
    expect(notificationUpsert).toHaveBeenCalledWith([
      expect.objectContaining({
        recipient_user_id: "trainer-1",
        actor_user_id: "athlete-1",
        type: "external_workout_completed",
        entity_id: "workout-1",
      }),
    ], { onConflict: "dedupe_key", ignoreDuplicates: true });
    expect(mocks.dispatchPush).toHaveBeenCalledWith(["trainer-1"], {
      title: "Nuova attività registrata",
      body: "Un cliente ha completato un allenamento.",
      href: "/?tab=clients",
    });
  });

  it("non richiede il servizio notifiche quando non ci sono attività", async () => {
    await expect(notifyTrainersOfExternalWorkouts("athlete-1", [])).resolves.toEqual({ notified: 0 });
    expect(mocks.createServiceSupabaseClient).not.toHaveBeenCalled();
  });
});
