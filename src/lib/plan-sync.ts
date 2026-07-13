"use client";

import { assignPlanLocally, db, saveTrainingPlan } from "./db";
import type { PlanAssignment, TrainingPlan } from "./types";
import { getRemoteAccessToken } from "./remote-sync";
import { applyPlanLocally } from "./plans";

export interface AssignedPlanSyncResult {
  plan: TrainingPlan | null;
  assignment: PlanAssignment | null;
  isNew: boolean;
}

async function getLocalActivePlanId(email: string) {
  const assignments = await db.planAssignments.toArray();
  const active = assignments.find(
    (entry) => entry.active && entry.athleteEmail.toLowerCase() === email.toLowerCase(),
  );
  return active?.planId ?? null;
}

export async function syncAssignedPlanFromCloud(): Promise<AssignedPlanSyncResult> {
  const token = await getRemoteAccessToken();
  if (!token) return { plan: null, assignment: null, isNew: false };

  const response = await fetch("/api/plans/assigned", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return { plan: null, assignment: null, isNew: false };

  const body = (await response.json()) as {
    plan: TrainingPlan | null;
    assignment: PlanAssignment | null;
  };

  if (!body.plan || !body.assignment) {
    return { plan: null, assignment: null, isNew: false };
  }

  const previousPlanId = await getLocalActivePlanId(body.assignment.athleteEmail);
  const isNew = previousPlanId !== body.plan.id;

  await assignPlanLocally(body.assignment);
  await applyPlanLocally(body.plan);
  await saveTrainingPlan(body.plan);

  return { plan: body.plan, assignment: body.assignment, isNew };
}
