import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRemoteUserProfile: vi.fn(),
  staffClient: vi.fn(),
}));

vi.mock("@/lib/supabase/profiles", () => ({
  getRemoteUserProfile: mocks.getRemoteUserProfile,
  staffClient: mocks.staffClient,
}));

import { GET } from "./route";

describe("GET /api/admin/errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRemoteUserProfile.mockResolvedValue({ userId: "admin-1", role: "admin" });
  });

  it("protegge anche i messaggi legacy già presenti nel database", async () => {
    const limit = vi.fn(async () => ({
      data: [{ id: "event-1", subsystem: "health", severity: "error", message: "Private shoulder note for alex@example.com", platform: "ios", created_at: "2026-07-15T10:00:00.000Z" }],
      error: null,
    }));
    const order = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ order }));
    mocks.staffClient.mockReturnValue({ from: vi.fn(() => ({ select })) });

    const response = await GET(new Request("http://localhost/api/admin/errors"));
    const body = await response.json() as { events: Array<{ message: string }> };

    expect(response.status).toBe(200);
    expect(body.events[0].message).toBe("Sincronizzazione Health non riuscita.");
  });
});
