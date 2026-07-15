"use client";

import { useEffect, useRef } from "react";
import { refreshAthleteCloudState } from "@/lib/cloud-refresh";
import type { PlanAssignment, TrainingPlan } from "@/lib/types";

const MIN_REFRESH_INTERVAL_MS = 5_000;

export function CloudRefreshManager({
  enabled,
  onNewPlan,
}: {
  enabled: boolean;
  onNewPlan: (plan: TrainingPlan, assignment: PlanAssignment | null) => void;
}) {
  const inFlightRef = useRef(false);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const refresh = async () => {
      const now = Date.now();
      if (inFlightRef.current
        || document.visibilityState === "hidden"
        || navigator.onLine === false
        || now - lastRefreshAtRef.current < MIN_REFRESH_INTERVAL_MS) return;
      inFlightRef.current = true;
      lastRefreshAtRef.current = now;
      try {
        const result = await refreshAthleteCloudState();
        if (result.assignedPlan?.isNew && result.assignedPlan.plan) {
          onNewPlan(result.assignedPlan.plan, result.assignedPlan.assignment);
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onOnline = () => { void refresh(); };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [enabled, onNewPlan]);

  return null;
}
