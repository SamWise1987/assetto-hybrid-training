"use client";

import { assignPlanLocally, db, saveTrainingPlan } from "./db";
import type { PlanAssignment, TrainingPlan } from "./types";
import { getRemoteAccessToken } from "./remote-sync";
import { applyPlanLocally } from "./plans";

export interface AssignedPlanSyncResult {
  plan: TrainingPlan | null;
  assignment: PlanAssignment | null;
  isNew: boolean;
  isUpdated: boolean;
  change: "assigned" | "updated" | null;
  reason?: string;
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
  if (!token) return { plan: null, assignment: null, isNew: false, isUpdated: false, change: null };

  const response = await fetch("/api/plans/assigned", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return { plan: null, assignment: null, isNew: false, isUpdated: false, change: null };

  const body = (await response.json()) as {
    plan: TrainingPlan | null;
    assignment: PlanAssignment | null;
    planVersion?: { version: number; reason: string; createdAt: string } | null;
  };

  if (!body.plan || !body.assignment) {
    return { plan: null, assignment: null, isNew: false, isUpdated: false, change: null };
  }

  const [previousPlanId, previousPlan] = await Promise.all([
    getLocalActivePlanId(body.assignment.athleteEmail),
    db.trainingPlans.get(body.plan.id),
  ]);
  const isNew = previousPlanId !== body.plan.id;
  const cloudVersion = body.planVersion?.version ?? body.plan.version;
  const localVersion = previousPlan?.version;
  const isUpdated = !isNew && Boolean(previousPlan) && (
    cloudVersion !== undefined && localVersion !== undefined
      ? cloudVersion > localVersion
      : previousPlan!.updatedAt < body.plan.updatedAt
  );
  const plan: TrainingPlan = {
    ...body.plan,
    version: cloudVersion,
    changeReason: body.planVersion?.reason ?? body.plan.changeReason,
    versionCreatedAt: body.planVersion?.createdAt ?? body.plan.versionCreatedAt,
  };

  await assignPlanLocally(body.assignment);
  await applyPlanLocally(plan);
  await saveTrainingPlan(plan);

  return {
    plan,
    assignment: body.assignment,
    isNew,
    isUpdated,
    change: isNew ? "assigned" : isUpdated ? "updated" : null,
    reason: plan.changeReason,
  };
}
