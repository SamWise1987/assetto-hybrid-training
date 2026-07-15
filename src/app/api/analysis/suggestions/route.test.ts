import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRemoteUserProfile: vi.fn(),
  staffClient: vi.fn(),
  dispatchPush: vi.fn(),
}));

vi.mock("@/lib/supabase/profiles", () => ({
  getRemoteUserProfile: mocks.getRemoteUserProfile,
  staffClient: mocks.staffClient,
}));
vi.mock("@/lib/push-server", () => ({ dispatchPush: mocks.dispatchPush }));

import { PATCH } from "./route";

const suggestionId = "11111111-1111-4111-8111-111111111111";
const athleteId = "22222222-2222-4222-8222-222222222222";

function currentSuggestion() {
  return {
    id: suggestionId,
    athlete_user_id: athleteId,
    title: "Aumenta gradualmente la corsa",
    rationale: "Il carico recente e stabile consente una progressione prudente.",
    proposed_change: { runDurationPercent: 5 },
    status: "modified",
  };
}

describe("PATCH /api/analysis/suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRemoteUserProfile.mockResolvedValue({
      userId: "coach-id",
      email: "coach@example.com",
      role: "coach",
    });
  });

  it("impedisce di applicare un suggerimento modificato senza approvazione", async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      single: vi.fn(async () => ({ data: currentSuggestion(), error: null })),
    };
    mocks.staffClient.mockReturnValue({ from: vi.fn(() => query) });

    const response = await PATCH(new Request("http://localhost/api/analysis/suggestions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: JSON.stringify({ id: suggestionId, status: "applied" }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("non consentita") });
  });

  it("salva una nuova revisione dei contenuti anche se lo stato resta modified", async () => {
    const updatedSuggestion = {
      ...currentSuggestion(),
      title: "Progressione corsa rivista",
      proposed_change: { runDurationPercent: 8 },
    };
    let singleCalls = 0;
    const analysisQuery = {
      select: vi.fn(() => analysisQuery),
      eq: vi.fn(() => analysisQuery),
      update: vi.fn(() => analysisQuery),
      single: vi.fn(async () => {
        singleCalls += 1;
        return { data: singleCalls === 1 ? currentSuggestion() : updatedSuggestion, error: null };
      }),
    };
    const notificationQuery = {
      upsert: vi.fn(() => notificationQuery),
      select: vi.fn(() => notificationQuery),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    };
    const auditQuery = { insert: vi.fn(async () => ({ error: null })) };
    mocks.staffClient.mockReturnValue({
      from: vi.fn((table: string) => table === "analysis_suggestions"
        ? analysisQuery
        : table === "app_notifications"
          ? notificationQuery
          : auditQuery),
    });

    const response = await PATCH(new Request("http://localhost/api/analysis/suggestions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: JSON.stringify({
        id: suggestionId,
        status: "modified",
        title: updatedSuggestion.title,
        rationale: updatedSuggestion.rationale,
        proposedChange: updatedSuggestion.proposed_change,
      }),
    }));

    expect(response.status).toBe(200);
    expect(analysisQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "modified",
      title: updatedSuggestion.title,
      proposed_change: updatedSuggestion.proposed_change,
    }));
    await expect(response.json()).resolves.toMatchObject({ suggestion: updatedSuggestion });
  });
});
