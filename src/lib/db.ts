"use client";

import Dexie, { type EntityTable } from "dexie";
import type {
  ActivePrescription,
  AccountProfile,
  AnalysisSuggestion,
  AppNotification,
  AppSettings,
  AthleteProfile,
  ClinicalSafetyProfile,
  CoachReview,
  DailyReadiness,
  DeloadDecision,
  Equipment,
  ExternalWorkout,
  ExerciseDefinition,
  NextDayResponse,
  PlanAssignment,
  ProgressionDecision,
  RunCalibrationDecision,
  RunPlan,
  RunSession,
  RunningWorkoutTemplate,
  HealthSyncState,
  SyncQueueItem,
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
import { undoRunCalibrationDecision } from "./run-calibration";
import type { TrainingPlanRunSession } from "./types";
import { getDay, subWeeks } from "date-fns";
import { BLOCK, DEMO_SEED, EQUIPMENT, EXERCISES, PROFILE, TEMPLATES } from "./program";
import { RUNNING_WORKOUT_TEMPLATES } from "@/data/running-workout-templates";
import { isTemporalHealthDuplicate } from "./health-matching";

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
  athleteProfiles!: EntityTable<AthleteProfile, "id">;
  externalWorkouts!: EntityTable<ExternalWorkout, "id">;
  healthSyncStates!: EntityTable<HealthSyncState, "id">;
  runningWorkoutTemplates!: EntityTable<RunningWorkoutTemplate, "id">;
  analysisSuggestions!: EntityTable<AnalysisSuggestion, "id">;
  notifications!: EntityTable<AppNotification, "id">;
  syncQueue!: EntityTable<SyncQueueItem, "id">;

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
    this.version(4).stores({
      profiles: "id, createdAt",
      equipment: "id, kind",
      safetyProfiles: "id",
      blocks: "id, startDate, status",
      exercises: "id, pattern, *muscleGroups",
      templates: "id, dayOfWeek, kind",
      workoutSessions: "id, date, templateId, status, syncedAt",
      runs: "id, date, type, status, syncedAt",
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
      athleteProfiles: "id, userId, updatedAt",
      externalWorkouts: "id, externalId, source, kind, startDate, matchedTemplateId, syncedAt",
      healthSyncStates: "id, platform, status, lastSuccessfulSyncAt",
      runningWorkoutTemplates: "id, category, level, updatedAt",
      analysisSuggestions: "id, athleteUserId, status, createdAt",
      notifications: "id, recipientUserId, createdAt, readAt",
      syncQueue: "id, entity, entityId, createdAt, attemptCount",
    });
  }
}

export const db = new AssettoDatabase();

const accountScopedTables = () => [
  db.profiles,
  db.safetyProfiles,
  db.blocks,
  db.workoutSessions,
  db.runs,
  db.readiness,
  db.nextDayResponses,
  db.progressionDecisions,
  db.deloadDecisions,
  db.activePrescriptions,
  db.runPlans,
  db.runCalibrationDecisions,
  db.coachReviews,
  db.templateCustomizations,
  db.trainingPlans,
  db.planAssignments,
  db.accountProfiles,
  db.athleteProfiles,
  db.externalWorkouts,
  db.healthSyncStates,
  db.analysisSuggestions,
  db.notifications,
  db.syncQueue,
];

/** Rimuove soltanto cache e log appartenenti all'account autenticato. */
export async function clearAccountScopedCache() {
  const tables = accountScopedTables();
  await db.transaction("rw", tables, async () => {
    await Promise.all(tables.map((table) => table.clear()));
  });
}

/**
 * Impedisce che un secondo account erediti o sincronizzi la cache del primo.
 * Il primo login conserva invece i dati legacy, che verranno migrati subito dopo.
 */
export async function prepareAccountCache(userId: string) {
  const settings = await db.appSettings.get("app-settings");
  if (!settings?.dataOwnerUserId) {
    await db.appSettings.put({
      ...(settings ?? defaultSettings),
      dataOwnerUserId: userId,
    });
    return "legacy" as const;
  }
  if (settings.dataOwnerUserId === userId) return "same-account" as const;

  await clearAccountScopedCache();
  await db.appSettings.put({
    id: "app-settings",
    aiCoachEnabled: settings.aiCoachEnabled,
    aiModel: settings.aiModel,
    onboardingVersion: settings.onboardingVersion,
    dataOwnerUserId: userId,
  });
  return "switched-account" as const;
}

export async function seedInitialData(options?: {
  name?: string;
  preferredGreeting?: import("./types").PreferredGreeting;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const existingSettings = await db.appSettings.get("app-settings");
  const resetTables = [
    db.profiles, db.equipment, db.safetyProfiles, db.blocks, db.exercises, db.templates,
    db.workoutSessions, db.runs, db.readiness, db.nextDayResponses, db.progressionDecisions,
    db.deloadDecisions, db.activePrescriptions, db.runPlans, db.runCalibrationDecisions,
    db.coachReviews, db.templateCustomizations, db.trainingPlans, db.planAssignments, db.appSettings,
    db.runningWorkoutTemplates,
  ];
  await db.transaction("rw", resetTables, async () => {
    await Promise.all(resetTables.map((table) => table.clear()));
    await db.profiles.add({
      ...PROFILE,
      name: options?.name?.trim() || "Atleta",
      preferredGreeting: options?.preferredGreeting ?? "neutral",
      createdAt: new Date().toISOString(),
    });
    await db.equipment.bulkAdd(EQUIPMENT);
    await db.safetyProfiles.add({
      id: "safety-default",
      limitations: [],
      excludedExercises: [],
      disclaimerAcceptedAt: new Date().toISOString(),
    });
    await db.blocks.add({ ...BLOCK, week: 1, startDate: today });
    await db.exercises.bulkAdd(EXERCISES);
    await db.templates.bulkAdd(TEMPLATES);
    await db.runPlans.bulkAdd(seedRunPlansForWeek(1));
    await db.appSettings.put({ ...defaultSettings, ...existingSettings });
    await db.runningWorkoutTemplates.bulkPut(RUNNING_WORKOUT_TEMPLATES);
  });
}

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

  await enqueueSync({ entity: "workout", entityId: session.id, operation: "upsert", payload: session as unknown as Record<string, unknown> });
  import("./normalized-sync").then(({ flushSyncQueue }) => flushSyncQueue()).catch(() => undefined);

  return decisions;
}

export async function completeRunSession(run: RunSession) {
  await db.runs.put(run);
  await enqueueSync({ entity: "run", entityId: run.id, operation: "upsert", payload: run as unknown as Record<string, unknown> });
  import("./normalized-sync").then(({ flushSyncQueue }) => flushSyncQueue()).catch(() => undefined);

  // Imported sources do not expose RPE, talk test or symptoms. They count for
  // history/adherence but cannot safely drive the deterministic calibration.
  if (run.subjectiveDataAvailable === false) return null;
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
  return { app: "RobertaFunctional", schemaVersion: 4, exportedAt: new Date().toISOString(), tables: result };
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

export async function applyCoachRunPlans(runSessions: TrainingPlanRunSession[]) {
  const plans = await ensureRunPlansForCurrentWeek();
  const updates: RunPlan[] = plans.map((plan) => {
    const override = runSessions.find((session) => session.dayOfWeek === plan.dayOfWeek);
    if (!override) return plan;
    return {
      ...plan,
      type: override.type,
      durationMinutes: override.durationMinutes,
      notes: override.notes ?? plan.notes,
      workoutTemplateId: override.workoutTemplateId,
      segments: override.segments,
      status: plan.status === "completed" ? "completed" : "planned",
    };
  });
  await db.runPlans.bulkPut(updates);
  return updates;
}

export async function undoRunCalibration(decisionId: string) {
  const decision = await db.runCalibrationDecisions.get(decisionId);
  if (!decision || decision.undoneAt) return null;

  const saturdayPlan = await db.runPlans.where("date").equals(decision.targetDate).first();
  if (!saturdayPlan) return null;

  const { decision: undoneDecision, restoredPlan } = undoRunCalibrationDecision(decision);

  await db.transaction("rw", [db.runPlans, db.runCalibrationDecisions], async () => {
    await db.runCalibrationDecisions.put(undoneDecision);
    await db.runPlans.put({
      ...saturdayPlan,
      type: restoredPlan.type,
      durationMinutes: restoredPlan.durationMinutes,
      status: "planned",
      notes: ["Calibrazione annullata: ripristinato il piano originale."],
    });
  });

  return undoneDecision;
}

export async function importExternalRun(run: RunSession) {
  if (run.externalId) {
    const existing = await db.runs
      .filter((entry) => entry.externalId === run.externalId)
      .first();
    if (existing) return { run: existing, imported: false, calibration: null };
  }
  const temporalMatch = await db.runs
    .filter((entry) => entry.source === run.source
      && entry.date === run.date
      && Math.abs(entry.durationMinutes - run.durationMinutes) <= 2
      && Math.abs((entry.distanceKm ?? 0) - (run.distanceKm ?? 0)) <= 0.15)
    .first();
  if (temporalMatch) return { run: temporalMatch, imported: false, calibration: null };

  const calibration = await completeRunSession(run);
  return { run, imported: true, calibration };
}

export async function importExternalWorkout(workout: ExternalWorkout) {
  const existing = await db.externalWorkouts
    .filter((entry) => entry.source === workout.source && entry.externalId === workout.externalId)
    .first();
  if (existing) return { workout: existing, imported: false };
  const temporalMatch = await db.externalWorkouts
    .filter((entry) => isTemporalHealthDuplicate(entry, workout))
    .first();
  if (temporalMatch) return { workout: temporalMatch, imported: false };

  await db.externalWorkouts.put(workout);
  await enqueueSync({ entity: "external_workout", entityId: workout.id, operation: "upsert", payload: workout as unknown as Record<string, unknown> });
  return { workout, imported: true };
}

export async function matchExternalWorkout(workoutId: string, templateId: string) {
  const workout = await db.externalWorkouts.get(workoutId);
  if (!workout) throw new Error("Attività esterna non trovata.");
  const matched = { ...workout, matchedTemplateId: templateId, matchedAt: new Date().toISOString() };
  await db.externalWorkouts.put(matched);
  await enqueueSync({ entity: "external_workout", entityId: matched.id, operation: "upsert", payload: matched as unknown as Record<string, unknown> });
  import("./normalized-sync").then(({ flushSyncQueue }) => flushSyncQueue()).catch(() => undefined);
  return matched;
}

export async function enqueueSync(item: Omit<SyncQueueItem, "id" | "createdAt" | "attemptCount">) {
  const queued: SyncQueueItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attemptCount: 0,
  };
  if (item.entity === "profile" || item.entity === "notification_read") {
    const olderItems = item.entity === "profile"
      ? await db.syncQueue.where("entity").equals("profile").primaryKeys()
      : (await db.syncQueue.where("entity").equals("notification_read").filter((queuedItem) => queuedItem.entityId === item.entityId).toArray()).map((queuedItem) => queuedItem.id);
    if (olderItems.length) await db.syncQueue.bulkDelete(olderItems);
  }
  await db.syncQueue.put(queued);
  return queued;
}

export async function markNotificationRead(id: string) {
  const notification = await db.notifications.get(id);
  if (!notification || notification.readAt) return notification;
  const readAt = new Date().toISOString();
  const updated = { ...notification, readAt };
  await db.notifications.put(updated);
  await enqueueSync({ entity: "notification_read", entityId: id, operation: "upsert", payload: { readAt } });
  return updated;
}
