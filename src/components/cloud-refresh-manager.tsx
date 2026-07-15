"use client";

import { useEffect, useRef } from "react";
import { refreshAthleteCloudState } from "@/lib/cloud-refresh";
import type { PlanAssignment, TrainingPlan } from "@/lib/types";

const MIN_REFRESH_INTERVAL_MS = 5_000;

export function CloudRefreshManager({
  enabled,
  onPlanChange,
}: {
  enabled: boolean;
  onPlanChange: (plan: TrainingPlan, assignment: PlanAssignment | null, change: "assigned" | "updated", reason?: string) => void;
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
        if (result.assignedPlan?.change && result.assignedPlan.plan) {
          onPlanChange(result.assignedPlan.plan, result.assignedPlan.assignment, result.assignedPlan.change, result.assignedPlan.reason);
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
  }, [enabled, onPlanChange]);

  return null;
}
