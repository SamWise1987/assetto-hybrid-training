"use client";

import Dexie, { type EntityTable } from "dexie";
import type {
  ActivePrescription,
  AccountProfile,
  AppSettings,
  ClinicalSafetyProfile,
  CoachReview,
  DailyReadiness,
  DeloadDecision,
  Equipment,
  ExerciseDefinition,
  NextDayResponse,
  PlanAssignment,
  ProgressionDecision,
  RunCalibrationDecision,
  RunPlan,
  RunSession,
  TemplateCustomization,
  TrainingBlock,
  TrainingPlan,
  UserProfile,
  WorkoutSession,
  WorkoutTemplate,
} from "./types";
import { defaultTrainingPlan } from "./plans";
import {
  buildWeeklyRunContext,
  evaluateWorkoutProgressions,
  findTuesdayAndSaturdayPlans,
  processTuesdayRunCalibration,
  seedRunPlansForWeek,
  toActivePrescriptions,
} from "./training-engine";
import { getDay, subWeeks } from "date-fns";
import { DEMO_SEED } from "./program";

const defaultSettings: AppSettings = {
  id: "app-settings",
  aiCoachEnabled: false,
  aiModel: "gpt-4.1-mini",
};

export class AssettoDatabase extends Dexie {
  profiles!: EntityTable<UserProfile, "id">;
  equipment!: EntityTable<Equipment, "id">;
  safetyProfiles!: EntityTable<ClinicalSafetyProfile, "id">;
  blocks!: EntityTable<TrainingBlock, "id">;
  exercises!: EntityTable<ExerciseDefinition, "id">;
  templates!: EntityTable<WorkoutTemplate, "id">;
  workoutSessions!: EntityTable<WorkoutSession, "id">;
  runs!: EntityTable<RunSession, "id">;
  readiness!: EntityTable<DailyReadiness, "id">;
  nextDayResponses!: EntityTable<NextDayResponse, "id">;
  progressionDecisions!: EntityTable<ProgressionDecision, "id">;
  deloadDecisions!: EntityTable<DeloadDecision, "id">;
  activePrescriptions!: EntityTable<ActivePrescription, "id">;
  runPlans!: EntityTable<RunPlan, "id">;
  runCalibrationDecisions!: EntityTable<RunCalibrationDecision, "id">;
  appSettings!: EntityTable<AppSettings, "id">;
  coachReviews!: EntityTable<CoachReview, "id">;
  templateCustomizations!: EntityTable<TemplateCustomization, "id">;
  trainingPlans!: EntityTable<TrainingPlan, "id">;
  planAssignments!: EntityTable<PlanAssignment, "id">;
  accountProfiles!: EntityTable<AccountProfile, "id">;

  constructor() {
    super("assetto-local-v1");
    this.version(1).stores({
      profiles: "id, createdAt",
      equipment: "id, kind",
      safetyProfiles: "id",
      blocks: "id, startDate, status",
      exercises: "id, pattern, *muscleGroups",
      templates: "id, dayOfWeek, kind",
      workoutSessions: "id, date, templateId, status",
      runs: "id, date, type, status",
      readiness: "id, date",
      nextDayResponses: "id, sessionId, date",
      progressionDecisions: "id, exerciseId, date, action",
      deloadDecisions: "id, date, scheduled",
    });
    this.version(2).stores({
      profiles: "id, createdAt",
      equipment: "id, kind",
      safetyProfiles: "id",
      blocks: "id, startDate, status",
      exercises: "id, pattern, *muscleGroups",
      templates: "id, dayOfWeek, kind",
      workoutSessions: "id, date, templateId, status",
      runs: "id, date, type, status",
      readiness: "id, date",
      nextDayResponses: "id, sessionId, date",
      progressionDecisions: "id, exerciseId, date, action",
      deloadDecisions: "id, date, scheduled",
      activePrescriptions: "id, exerciseId, templateId",
      runPlans: "id, date, dayOfWeek, week, status",
      runCalibrationDecisions: "id, date, targetDate, rule",
      appSettings: "id",
      coachReviews: "id, date, week",
    });
    this.version(3).stores({
      profiles: "id, createdAt",
      equipment: "id, kind",
      safetyProfiles: "id",
      blocks: "id, startDate, status",
      exercises: "id, pattern, *muscleGroups",
      templates: "id, dayOfWeek, kind",
      workoutSessions: "id, date, templateId, status",
      runs: "id, date, type, status",
      readiness: "id, date",
      nextDayResponses: "id, sessionId, date",
      progressionDecisions: "id, exerciseId, date, action",
      deloadDecisions: "id, date, scheduled",
      activePrescriptions: "id, exerciseId, templateId",
      runPlans: "id, date, dayOfWeek, week, status",
      runCalibrationDecisions: "id, date, targetDate, rule",
      appSettings: "id",
      coachReviews: "id, date, week",
      templateCustomizations: "id, templateId",
      trainingPlans: "id, createdAt, createdBy",
      planAssignments: "id, planId, athleteEmail, active",
      accountProfiles: "id, userId, email, role",
    });
  }
}

export const db = new AssettoDatabase();

export async function seedDemoData() {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await db.profiles.add(DEMO_SEED.profile);
    await db.equipment.bulkAdd(DEMO_SEED.equipment);
    await db.safetyProfiles.add(DEMO_SEED.safetyProfile);
    await db.blocks.add(DEMO_SEED.block);
    await db.exercises.bulkAdd(DEMO_SEED.exercises);
    await db.templates.bulkAdd(DEMO_SEED.templates);
    await db.readiness.bulkAdd(DEMO_SEED.readiness);
    await db.workoutSessions.bulkAdd(DEMO_SEED.workoutSessions);
    await db.runs.bulkAdd(DEMO_SEED.runs);
    await db.progressionDecisions.bulkAdd(DEMO_SEED.decisions);
    await db.runPlans.bulkAdd(seedRunPlansForWeek(DEMO_SEED.block.week));
    await db.appSettings.put(defaultSettings);
    await db.trainingPlans.put(defaultTrainingPlan("seed"));
  });
}

export async function saveTemplateCustomization(custom: TemplateCustomization) {
  await db.templateCustomizations.put(custom);
}

export async function saveTrainingPlan(plan: TrainingPlan) {
  await db.transaction("rw", [db.trainingPlans, db.templateCustomizations], async () => {
    await db.trainingPlans.put(plan);
    const { planSessionsToCustomizations } = await import("./plans");
    await db.templateCustomizations.bulkPut(planSessionsToCustomizations(plan));
  });
}

export async function assignPlanLocally(assignment: PlanAssignment) {
  await db.transaction("rw", db.planAssignments, async () => {
    const existing = await db.planAssignments.toArray();
    await Promise.all(
      existing
        .filter((entry) => entry.athleteEmail.toLowerCase() === assignment.athleteEmail.toLowerCase())
        .map((entry) => db.planAssignments.put({ ...entry, active: false })),
    );
    await db.planAssignments.put(assignment);
  });
}

export async function getResolvedTemplates() {
  const [storedTemplates, customizations, plans, assignments, account] = await Promise.all([
    db.templates.toArray(),
    db.templateCustomizations.toArray(),
    db.trainingPlans.toArray(),
    db.planAssignments.toArray(),
    db.accountProfiles.toCollection().first(),
  ]);
  const activeAssignment = account
    ? assignments.find(
        (entry) => entry.active && entry.athleteEmail.toLowerCase() === account.email.toLowerCase(),
      )
    : assignments.find((entry) => entry.active);
  const activePlan = activeAssignment
    ? plans.find((plan) => plan.id === activeAssignment.planId) ?? null
    : plans.at(-1) ?? null;

  const { resolveTemplates } = await import("./templates");
  return resolveTemplates(storedTemplates, customizations, activePlan);
}

export async function ensureRunPlansForCurrentWeek() {
  const block = await db.blocks.toCollection().first();
  const week = block?.week ?? 1;
  const existing = await db.runPlans.toArray();
  if (existing.length) return existing;
  const plans = seedRunPlansForWeek(week);
  await db.runPlans.bulkAdd(plans);
  return plans;
}

export async function getActiveBlockWeek() {
  const block = await db.blocks.toCollection().first();
  return block?.week ?? 1;
}

export async function completeWorkoutSession(session: WorkoutSession) {
  const template = await db.templates.get(session.templateId);
  const readiness = session.readinessId ? await db.readiness.get(session.readinessId) : undefined;
  const nextDayResponse = await db.nextDayResponses
    .where("sessionId")
    .equals(session.id)
    .first();
  const existingPrescriptions = await db.activePrescriptions.toArray();
  const priorDecisions = await db.progressionDecisions
    .where("exerciseId")
    .anyOf(template?.prescriptions.map((entry) => entry.exerciseId) ?? [])
    .toArray();

  const exposureCounts = Object.fromEntries(
    (template?.prescriptions ?? []).map((prescription) => {
      const count = priorDecisions.filter(
        (decision) =>
          decision.exerciseId === prescription.exerciseId &&
          !decision.undoneAt &&
          decision.action === "progress",
      ).length;
      return [prescription.exerciseId, Math.max(1, count + 1)];
    }),
  );

  const decisions = evaluateWorkoutProgressions({
    templateId: session.templateId,
    prescriptions: template?.prescriptions ?? [],
    setLogs: session.setLogs,
    nextDayResponse,
    neurologicalSymptoms: readiness?.armNeurologicalSymptoms,
    exposureCounts,
  });

  await db.transaction("rw", [db.workoutSessions, db.progressionDecisions, db.activePrescriptions], async () => {
    await db.workoutSessions.put({ ...session, status: "complete" });
    if (decisions.length) {
      await db.progressionDecisions.bulkPut(decisions);
      await db.activePrescriptions.bulkPut(
        toActivePrescriptions(session.templateId, decisions, existingPrescriptions),
      );
    }
  });

  return decisions;
}

export async function completeRunSession(run: RunSession) {
  await db.runs.put(run);

  const day = getDay(new Date(`${run.date}T12:00:00`));
  if (day !== 2) return null;

  const blockWeek = await getActiveBlockWeek();
  const plans = await ensureRunPlansForCurrentWeek();
  const { tuesday, saturday } = findTuesdayAndSaturdayPlans(plans);
  if (!tuesday || !saturday) return null;

  const previousWeekStart = subWeeks(new Date(`${run.date}T12:00:00`), 1);
  const previousWeekRuns = await db.runs
    .filter((entry) => {
      const entryDate = new Date(`${entry.date}T12:00:00`);
      return entryDate >= previousWeekStart && entryDate < new Date(`${run.date}T12:00:00`);
    })
    .toArray();

  const latestReadiness = await db.readiness.orderBy("date").last();
  const context = buildWeeklyRunContext(blockWeek, previousWeekRuns, latestReadiness);
  const { decision, updatedSaturdayPlan } = processTuesdayRunCalibration({
    run,
    tuesdayPlan: { ...tuesday, status: "completed" },
    saturdayPlan: saturday,
    context,
  });

  await db.transaction("rw", [db.runPlans, db.runCalibrationDecisions], async () => {
    await db.runPlans.put({ ...tuesday, status: "completed", sourceRunId: run.id });
    await db.runPlans.put(updatedSaturdayPlan);
    await db.runCalibrationDecisions.put(decision);
  });

  return decision;
}

export async function exportDatabase() {
  const result: Record<string, unknown[]> = {};
  for (const table of db.tables) result[table.name] = await table.toArray();
  return { app: "Assetto", schemaVersion: 2, exportedAt: new Date().toISOString(), tables: result };
}

export async function importDatabase(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("tables" in payload)) throw new Error("Backup non valido");
  const tables = (payload as { tables: Record<string, unknown[]> }).tables;
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
      const rows = tables[table.name];
      if (Array.isArray(rows) && rows.length) await table.bulkAdd(rows);
    }
  });
}

export async function clearDatabase() {
  await db.transaction("rw", db.tables, async () => Promise.all(db.tables.map((table) => table.clear())));
}

export async function exportHistoryCsv() {
  const sessions = await db.workoutSessions.toArray();
  const runs = await db.runs.toArray();
  const header = "tipo,data,nome,durata_minuti,rpe,stato";
  const strengthRows = sessions.map((session) =>
    ["forza", session.date, session.templateId, session.durationMinutes ?? "", session.sessionRpe ?? "", session.status].join(","),
  );
  const runRows = runs.map((run) =>
    ["corsa", run.date, run.type, run.durationMinutes, run.rpe, run.status].join(","),
  );
  return [header, ...strengthRows, ...runRows].join("\n");
}

export async function getTodayRunPlan(date = new Date()) {
  await ensureRunPlansForCurrentWeek();
  const iso = date.toISOString().slice(0, 10);
  return db.runPlans.where("date").equals(iso).first();
}
