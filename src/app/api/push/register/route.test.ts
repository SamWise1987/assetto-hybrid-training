import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRemoteUserProfile: vi.fn(),
  staffClient: vi.fn(),
}));

vi.mock("@/lib/supabase/profiles", () => ({
  getRemoteUserProfile: mocks.getRemoteUserProfile,
  staffClient: mocks.staffClient,
}));

import { DELETE, GET, POST } from "./route";

describe("/api/push/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRemoteUserProfile.mockResolvedValue({ userId: "user-1", role: "athlete" });
  });

  it("non dichiara disponibile lo stato se Supabase fallisce", async () => {
    const eq = vi.fn(async () => ({ data: null, error: { message: "query failed" } }));
    mocks.staffClient.mockReturnValue({ from: vi.fn(() => ({ select: vi.fn(() => ({ eq })) })) });

    const response = await GET(new Request("http://localhost/api/push/register"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "query failed" });
  });

  it("propaga l'errore di registrazione invece di restituire un falso successo", async () => {
    const upsert = vi.fn(async () => ({ error: { message: "insert failed" } }));
    mocks.staffClient.mockReturnValue({ from: vi.fn(() => ({ upsert })) });

    const response = await POST(new Request("http://localhost/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "web",
        deviceId: "device-1",
        endpoint: "https://push.example/subscription",
        p256dh: "public-key",
        auth: "auth-secret",
      }),
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "insert failed" });
  });

  it("rimuove soltanto la registrazione del dispositivo e propaga gli errori", async () => {
    const deviceEq = vi.fn(async () => ({ error: { message: "delete failed" } }));
    const platformEq = vi.fn(() => ({ eq: deviceEq }));
    const userEq = vi.fn(() => ({ eq: platformEq }));
    const remove = vi.fn(() => ({ eq: userEq }));
    mocks.staffClient.mockReturnValue({ from: vi.fn(() => ({ delete: remove })) });

    const response = await DELETE(new Request("http://localhost/api/push/register", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "ios", deviceId: "iphone-1" }),
    }));

    expect(userEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(platformEq).toHaveBeenCalledWith("platform", "ios");
    expect(deviceEq).toHaveBeenCalledWith("device_id", "iphone-1");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "delete failed" });
  });
});
