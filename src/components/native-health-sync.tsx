"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { db } from "@/lib/db";
import { getNativePlatform, importNativeWorkouts, isNativeShell, recordNativeHealthFailure } from "@/lib/native-health";

const MIN_SYNC_INTERVAL_MS = 15 * 60 * 1000;

export function NativeHealthSync({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || !isNativeShell()) return;
    const platform = getNativePlatform();
    if (platform === "web") return;

    const syncIfDue = async (foreground = false) => {
      const state = await db.healthSyncStates.get(`health-${platform}`);
      if (!state?.lastSuccessfulSyncAt || state.status === "denied" || state.status === "syncing") return;
      if (!foreground && Date.now() - new Date(state.lastSuccessfulSyncAt).getTime() < MIN_SYNC_INTERVAL_MS) return;
      await importNativeWorkouts(30, state.lastSuccessfulSyncAt).catch(async (error) => {
        await recordNativeHealthFailure(error);
      });
    };

    syncIfDue().catch(() => undefined);
    const listener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) syncIfDue(true).catch(() => undefined);
    });
    return () => { listener.then((handle) => handle.remove()).catch(() => undefined); };
  }, [enabled]);

  return null;
}
