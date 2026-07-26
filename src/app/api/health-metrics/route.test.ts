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

import { GET, POST } from "./route";

const athleteId = "22222222-2222-4222-8222-222222222222";
const metricId = "33333333-3333-4333-8333-333333333333";

describe("/api/health-metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRemoteUserProfile.mockResolvedValue({ userId: athleteId, role: "athlete" });
    mocks.verifyActiveTrainerClient.mockResolvedValue({ allowed: true, error: null });
  });

  it("restituisce i segnali salute dell'atleta", async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(async () => ({
        data: [{ id: metricId, metric_type: "restingHeartRate", value: 54, user_id: athleteId }],
        error: null,
      })),
    };
    mocks.staffClient.mockReturnValue({ from: vi.fn(() => query) });

    const response = await GET(new Request("http://localhost/api/health-metrics"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      metrics: [{ id: metricId, metric_type: "restingHeartRate", value: 54, user_id: athleteId }],
    });
  });

  it("impedisce agli admin di leggere i dettagli Health", async () => {
    mocks.getRemoteUserProfile.mockResolvedValue({ userId: "admin-id", role: "admin" });
    const response = await GET(new Request("http://localhost/api/health-metrics"));
    expect(response.status).toBe(403);
  });

  it("salva le metriche importate da Apple Health", async () => {
    const query = {
      upsert: vi.fn(async () => ({ error: null })),
    };
    mocks.staffClient.mockReturnValue({ from: vi.fn(() => query) });

    const response = await POST(new Request("http://localhost/api/health-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metrics: [{
          id: metricId,
          type: "respiratoryRate",
          value: 14,
          unit: "count/min",
          recordedAt: "2026-07-20T06:00:00.000Z",
          source: "apple_health",
          platform: "ios",
          externalId: "hk-rr-1",
          sourceName: "Apple Watch",
          importedAt: "2026-07-20T07:00:00.000Z",
        }],
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ synced: 1 });
    expect(query.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: metricId,
        user_id: athleteId,
        metric_type: "respiratoryRate",
        external_id: "hk-rr-1",
        source: "apple_health",
      }),
    ], { onConflict: "user_id,source,external_id" });
  });
});
