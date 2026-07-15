import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pullAthleteProfileFromCloud: vi.fn(),
  pullExternalWorkoutsFromCloud: vi.fn(),
  pullNormalizedHistory: vi.fn(),
  syncAssignedPlanFromCloud: vi.fn(),
}));

vi.mock("./remote-sync", () => ({
  pullAthleteProfileFromCloud: mocks.pullAthleteProfileFromCloud,
  pullExternalWorkoutsFromCloud: mocks.pullExternalWorkoutsFromCloud,
}));
vi.mock("./normalized-sync", () => ({ pullNormalizedHistory: mocks.pullNormalizedHistory }));
vi.mock("./plan-sync", () => ({ syncAssignedPlanFromCloud: mocks.syncAssignedPlanFromCloud }));

import { refreshAthleteCloudState } from "./cloud-refresh";

describe("refreshAthleteCloudState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pullAthleteProfileFromCloud.mockResolvedValue({ user_id: "athlete-id" });
    mocks.pullExternalWorkoutsFromCloud.mockResolvedValue([{ id: "health-1" }, { id: "health-2" }]);
    mocks.pullNormalizedHistory.mockResolvedValue(4);
    mocks.syncAssignedPlanFromCloud.mockResolvedValue({ plan: { id: "plan-1" }, assignment: { id: "assignment-1" }, isNew: true });
  });

  it("aggiorna in parallelo profilo, Health, storico e piano", async () => {
    const result = await refreshAthleteCloudState();

    expect(result).toMatchObject({
      profileUpdated: true,
      externalWorkoutCount: 2,
      normalizedItemCount: 4,
      assignedPlan: { plan: { id: "plan-1" }, isNew: true },
      failures: 0,
    });
    expect(mocks.pullAthleteProfileFromCloud).toHaveBeenCalledOnce();
    expect(mocks.pullExternalWorkoutsFromCloud).toHaveBeenCalledOnce();
    expect(mocks.pullNormalizedHistory).toHaveBeenCalledOnce();
    expect(mocks.syncAssignedPlanFromCloud).toHaveBeenCalledOnce();
  });

  it("completa l'inizializzazione del profilo prima di scrivere piano e storico", async () => {
    let finishProfile: ((value: { user_id: string }) => void) | undefined;
    mocks.pullAthleteProfileFromCloud.mockImplementation(() => new Promise((resolve) => {
      finishProfile = resolve;
    }));

    const refresh = refreshAthleteCloudState();
    await vi.waitFor(() => expect(mocks.pullAthleteProfileFromCloud).toHaveBeenCalledOnce());
    expect(mocks.pullExternalWorkoutsFromCloud).not.toHaveBeenCalled();
    expect(mocks.pullNormalizedHistory).not.toHaveBeenCalled();
    expect(mocks.syncAssignedPlanFromCloud).not.toHaveBeenCalled();

    finishProfile?.({ user_id: "athlete-id" });
    await refresh;

    expect(mocks.pullExternalWorkoutsFromCloud).toHaveBeenCalledOnce();
    expect(mocks.pullNormalizedHistory).toHaveBeenCalledOnce();
    expect(mocks.syncAssignedPlanFromCloud).toHaveBeenCalledOnce();
  });

  it("mantiene utilizzabili gli altri dati se una singola fonte fallisce", async () => {
    mocks.pullExternalWorkoutsFromCloud.mockRejectedValue(new Error("offline"));

    await expect(refreshAthleteCloudState()).resolves.toMatchObject({
      profileUpdated: true,
      externalWorkoutCount: 0,
      normalizedItemCount: 4,
      assignedPlan: { plan: { id: "plan-1" } },
      failures: 1,
    });
  });
});
