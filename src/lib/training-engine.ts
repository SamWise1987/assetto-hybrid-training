import { evaluateExerciseProgression } from "./autoregulation";
import {
  calibrateSaturdayRun,
  defaultRunPlanForDay,
  RUN_DAYS,
  sumRunMinutes,
  weekDates,
  type WeeklyRunContext,
} from "./run-calibration";
import { EXERCISES, getCycleTargets, TEMPLATES } from "./program";
import type {
  ActivePrescription,
  ExercisePrescription,
  NextDayResponse,
  ProgressionDecision,
  RunCalibrationDecision,
  RunPlan,
  RunSession,
  SetLog,
  WorkoutSession,
} from "./types";

export function groupSetLogsByPrescription(logs: readonly SetLog[]) {
  const grouped = new Map<string, SetLog[]>();
  for (const log of logs) {
    const current = grouped.get(log.prescriptionId) ?? [];
    current.push(log);
    grouped.set(log.prescriptionId, current);
  }
  return grouped;
}

export function buildExerciseExposureInput(
  prescription: ExercisePrescription,
  logs: readonly SetLog[],
  options: {
    consecutiveSuccessfulExposures: number;
    upperBody: boolean;
    nextDayResponse?: NextDayResponse;
    neurologicalSymptoms?: boolean;
  },
) {
  const pain = Math.max(...logs.map((log) => Math.max(log.shoulderPain, log.cervicalSymptoms)), 0);
  return {
    exerciseId: prescription.exerciseId,
    prescription,
    reps: logs.map((log) => log.reps ?? 0),
    rirs: logs.map((log) => log.rir),
    pain,
    technique: logs.map((log) => log.technique),
    consecutiveSuccessfulExposures: options.consecutiveSuccessfulExposures,
    upperBody: options.upperBody,
    nextDayBackToBaseline:
      options.nextDayResponse === undefined
        ? undefined
        : options.nextDayResponse.shoulderBackToBaseline &&
          options.nextDayResponse.cervicalBackToBaseline,
    neurologicalSymptoms: options.neurologicalSymptoms,
  };
}

export function evaluateWorkoutProgressions(input: {
  templateId: string;
  prescriptions: ExercisePrescription[];
  setLogs: readonly SetLog[];
  nextDayResponse?: NextDayResponse;
  neurologicalSymptoms?: boolean;
  exposureCounts?: Record<string, number>;
}): ProgressionDecision[] {
  const grouped = groupSetLogsByPrescription(input.setLogs);
  const decisions: ProgressionDecision[] = [];

  for (const prescription of input.prescriptions) {
    const logs = grouped.get(prescription.id);
    if (!logs?.length) continue;

    const exercise = EXERCISES.find((entry) => entry.id === prescription.exerciseId);
    const decision = evaluateExerciseProgression(
      buildExerciseExposureInput(prescription, logs, {
        consecutiveSuccessfulExposures: input.exposureCounts?.[prescription.exerciseId] ?? 1,
        upperBody: exercise?.upperBody ?? false,
        nextDayResponse: input.nextDayResponse,
        neurologicalSymptoms: input.neurologicalSymptoms,
      }),
    );
    decisions.push(decision);
  }

  return decisions;
}

export function toActivePrescriptions(
  templateId: string,
  decisions: readonly ProgressionDecision[],
  existing: readonly ActivePrescription[],
): ActivePrescription[] {
  const byExercise = new Map(existing.map((entry) => [entry.exerciseId, entry]));
  const updatedAt = new Date().toISOString();

  for (const decision of decisions) {
    if (decision.undoneAt) continue;
    byExercise.set(decision.exerciseId, {
      id: `active-${templateId}-${decision.exerciseId}`,
      exerciseId: decision.exerciseId,
      templateId,
      prescription: decision.outputPrescription,
      updatedAt,
    });
  }

  return [...byExercise.values()];
}

export function mergeTemplatePrescriptions(
  templateId: string,
  activePrescriptions: readonly ActivePrescription[],
  templates: readonly import("./types").WorkoutTemplate[] = TEMPLATES,
): ExercisePrescription[] {
  const template = templates.find((entry) => entry.id === templateId);
  if (!template) return [];

  const overrides = new Map(
    activePrescriptions
      .filter((entry) => entry.templateId === templateId)
      .map((entry) => [entry.exerciseId, entry.prescription]),
  );

  return template.prescriptions.map(
    (prescription) => overrides.get(prescription.exerciseId) ?? prescription,
  );
}

export function getTemplateForDayWithOverrides(
  dayOfWeek: number,
  activePrescriptions: readonly ActivePrescription[],
  templates: readonly import("./types").WorkoutTemplate[],
) {
  const source = templates.length > 0 ? templates : TEMPLATES;
  const template = source.find((entry) => entry.dayOfWeek === dayOfWeek) ?? source[0];
  return {
    ...template,
    prescriptions: mergeTemplatePrescriptions(template.id, activePrescriptions, source),
  };
}

export function buildWeeklyRunContext(
  weekNumber: number,
  previousWeekRuns: readonly RunSession[],
  readiness?: { legSoreness?: number },
): WeeklyRunContext {
  const targets = getCycleTargets(weekNumber);
  return {
    weekNumber,
    previousWeekTotalMinutes: sumRunMinutes(previousWeekRuns),
    runsEasyOnly: targets.runsEasyOnly,
    legSoreness: readiness?.legSoreness,
    fridayLowerBodyHeavy: weekNumber >= 5,
  };
}

export function processTuesdayRunCalibration(input: {
  run: RunSession;
  tuesdayPlan: RunPlan;
  saturdayPlan: RunPlan;
  context: WeeklyRunContext;
}): { decision: RunCalibrationDecision; updatedSaturdayPlan: RunPlan } {
  const decision = calibrateSaturdayRun({
    tuesdayPlanned: input.tuesdayPlan,
    tuesdayActual: input.run,
    saturdayOriginal: input.saturdayPlan,
    context: input.context,
    targetDate: input.saturdayPlan.date,
  });

  return {
    decision,
    updatedSaturdayPlan: {
      ...input.saturdayPlan,
      type: decision.outputPlan.type,
      durationMinutes: decision.outputPlan.durationMinutes,
      status: "calibrated",
      sourceRunId: input.run.id,
      notes: [decision.reason],
    },
  };
}

export function seedRunPlansForWeek(week: number, reference = new Date()): RunPlan[] {
  return weekDates(reference)
    .map(({ date, dayOfWeek }) => defaultRunPlanForDay(week, dayOfWeek, date))
    .filter((plan): plan is RunPlan => plan !== null);
}

export function findTuesdayAndSaturdayPlans(plans: readonly RunPlan[]) {
  return {
    tuesday: plans.find((plan) => plan.dayOfWeek === RUN_DAYS.tuesday),
    saturday: plans.find((plan) => plan.dayOfWeek === RUN_DAYS.saturday),
  };
}

export function summarizeWorkoutForCoach(session: WorkoutSession, templateName: string) {
  return {
    date: session.date,
    template: templateName,
    durationMinutes: session.durationMinutes,
    sessionRpe: session.sessionRpe,
    setsLogged: session.setLogs.length,
    weights: session.setLogs.map((log) => ({
      reps: log.reps,
      rir: log.rir,
      weightKg: log.weightPerDumbbellKg,
      dumbbells: log.dumbbellCount,
    })),
    feeling: session.generalFeeling,
  };
}

export function summarizeRunForCoach(run: RunSession) {
  return {
    date: run.date,
    type: run.type,
    durationMinutes: run.durationMinutes,
    distanceKm: run.distanceKm,
    rpe: run.rpe,
    symptomsDuring: run.symptomsDuring,
    conversionReason: run.conversionReason,
  };
}
