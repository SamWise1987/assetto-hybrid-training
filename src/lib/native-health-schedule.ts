import type { HealthSyncState } from "./types";

export const NATIVE_HEALTH_MIN_SYNC_INTERVAL_MS = 15 * 60 * 1000;
export const NATIVE_HEALTH_STALE_SYNC_MS = 5 * 60 * 1000;

export function shouldRunNativeHealthSync(state: HealthSyncState | undefined, foreground: boolean, now = Date.now()) {
  if (!state?.lastSuccessfulSyncAt || state.status === "denied") return false;
  if (state.status === "syncing") {
    const lastAttempt = state.lastAttemptAt ? new Date(state.lastAttemptAt).getTime() : Number.NaN;
    if (Number.isFinite(lastAttempt) && now - lastAttempt < NATIVE_HEALTH_STALE_SYNC_MS) return false;
    return true;
  }
  if (foreground) return true;
  const lastSuccessful = new Date(state.lastSuccessfulSyncAt).getTime();
  return !Number.isFinite(lastSuccessful) || now - lastSuccessful >= NATIVE_HEALTH_MIN_SYNC_INTERVAL_MS;
}
