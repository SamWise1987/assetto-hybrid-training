"use client";

import { pullNormalizedHistory } from "./normalized-sync";
import { syncAssignedPlanFromCloud, type AssignedPlanSyncResult } from "./plan-sync";
import { pullAthleteProfileFromCloud, pullExternalWorkoutsFromCloud } from "./remote-sync";

export interface AthleteCloudRefreshResult {
  profileUpdated: boolean;
  externalWorkoutCount: number;
  normalizedItemCount: number;
  assignedPlan: AssignedPlanSyncResult | null;
  failures: number;
}

export async function refreshAthleteCloudState(): Promise<AthleteCloudRefreshResult> {
  // Il profilo può inizializzare IndexedDB e ripulire le tabelle legacy:
  // deve terminare prima dei pull che scrivono piano e attività.
  const [profileResult] = await Promise.allSettled([pullAthleteProfileFromCloud()]);
  const results = await Promise.allSettled([
    pullExternalWorkoutsFromCloud(),
    pullNormalizedHistory(),
    syncAssignedPlanFromCloud(),
  ] as const);

  return {
    profileUpdated: profileResult.status === "fulfilled" && Boolean(profileResult.value),
    externalWorkoutCount: results[0].status === "fulfilled" ? results[0].value.length : 0,
    normalizedItemCount: results[1].status === "fulfilled" ? results[1].value : 0,
    assignedPlan: results[2].status === "fulfilled" ? results[2].value : null,
    failures: (profileResult.status === "rejected" ? 1 : 0)
      + results.filter((result) => result.status === "rejected").length,
  };
}
