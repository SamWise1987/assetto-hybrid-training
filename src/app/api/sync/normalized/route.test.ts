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

import { GET, POST } from "./route";

const athleteId = "22222222-2222-4222-8222-222222222222";

describe("GET /api/sync/normalized", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.staffClient.mockReturnValue({ from: vi.fn() });
    mocks.verifyActiveTrainerClient.mockResolvedValue({ allowed: false, error: null });
  });

  it("non espone i log dettagliati degli atleti all'admin", async () => {
    mocks.getRemoteUserProfile.mockResolvedValue({ userId: "admin-id", role: "admin" });

    const response = await GET(new Request(`http://localhost/api/sync/normalized?userId=${athleteId}`));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "I log dettagliati degli atleti non sono disponibili agli amministratori." });
    expect(mocks.verifyActiveTrainerClient).not.toHaveBeenCalled();
  });

  it("non espone lo storico del cliente assegnato a un altro trainer", async () => {
    mocks.getRemoteUserProfile.mockResolvedValue({ userId: "second-coach-id", role: "coach" });

    const response = await GET(new Request(`http://localhost/api/sync/normalized?userId=${athleteId}`));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Cliente non assegnato a questo trainer." });
    expect(mocks.verifyActiveTrainerClient).toHaveBeenCalledWith(expect.anything(), "second-coach-id", athleteId);
  });
});

describe("POST /api/sync/normalized", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRemoteUserProfile.mockResolvedValue({ userId: athleteId, role: "athlete" });
  });

  it("sincronizza la lettura soltanto per il destinatario autenticato", async () => {
    const finalEq = vi.fn(async () => ({ error: null }));
    const firstEq = vi.fn(() => ({ eq: finalEq }));
    const update = vi.fn(() => ({ eq: firstEq }));
    const from = vi.fn(() => ({ update }));
    mocks.staffClient.mockReturnValue({ from });

    const response = await POST(new Request("http://localhost/api/sync/normalized", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{
        entity: "notification_read",
        entityId: "notice-1",
        payload: { readAt: "2026-07-15T12:00:00.000Z" },
      }] }),
    }));

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("app_notifications");
    expect(update).toHaveBeenCalledWith({ read_at: "2026-07-15T12:00:00.000Z" });
    expect(firstEq).toHaveBeenCalledWith("id", "notice-1");
    expect(finalEq).toHaveBeenCalledWith("recipient_user_id", athleteId);
  });
});
