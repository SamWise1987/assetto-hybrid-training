import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRemoteUserProfile: vi.fn(),
  staffClient: vi.fn(),
}));

vi.mock("@/lib/supabase/profiles", () => ({
  getRemoteUserProfile: mocks.getRemoteUserProfile,
  staffClient: mocks.staffClient,
}));

import { PATCH } from "./route";

const notificationId = "11111111-1111-4111-8111-111111111111";

function clientReturning(data: { id: string } | null) {
  const query = {
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };
  return { client: { from: vi.fn(() => query) }, query };
}

describe("PATCH /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRemoteUserProfile.mockResolvedValue({ userId: "athlete-id", role: "athlete" });
  });

  it("restituisce 404 quando la notifica non appartiene all'utente", async () => {
    const { client } = clientReturning(null);
    mocks.staffClient.mockReturnValue(client);

    const response = await PATCH(new Request("http://localhost/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: notificationId }),
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Notifica non trovata." });
  });

  it("conferma la lettura soltanto dopo aver ricevuto la riga aggiornata", async () => {
    const { client, query } = clientReturning({ id: notificationId });
    mocks.staffClient.mockReturnValue(client);

    const response = await PATCH(new Request("http://localhost/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: notificationId }),
    }));

    expect(response.status).toBe(200);
    expect(query.select).toHaveBeenCalledWith("id");
    await expect(response.json()).resolves.toEqual({ read: true });
  });
});
