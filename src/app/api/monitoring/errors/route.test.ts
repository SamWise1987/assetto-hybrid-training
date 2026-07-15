import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRemoteUserProfile: vi.fn(),
  staffClient: vi.fn(),
}));

vi.mock("@/lib/supabase/profiles", () => ({
  getRemoteUserProfile: mocks.getRemoteUserProfile,
  staffClient: mocks.staffClient,
}));

import { POST } from "./route";

describe("POST /api/monitoring/errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRemoteUserProfile.mockResolvedValue({ userId: "user-1", role: "athlete" });
  });

  it("sanitizza nuovamente l'evento sul server", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    mocks.staffClient.mockReturnValue({ from: vi.fn(() => ({ insert })) });

    const response = await POST(new Request("http://localhost/api/monitoring/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subsystem: "health",
        severity: "error",
        message: "HealthKit failed for alex@example.com: shoulder pain in private note",
        context: { status: 500, healthPayload: { heartRate: 180 }, email: "alex@example.com" },
        platform: "ios",
      }),
    }));

    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-1",
      message: "Sincronizzazione Health non riuscita.",
      context: { status: 500 },
      platform: "ios",
    }));
  });
});
