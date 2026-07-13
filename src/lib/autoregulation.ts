import type {
  DailyReadiness,
  DeloadDecision,
  ExercisePrescription,
  ProgressionDecision,
  TechniqueQuality,
} from "./types";

export const DIFFICULTY_LADDER = [
  "repetitions",
  "slow-eccentric",
  "pause",
  "one-and-a-half-reps",
  "harder-variant",
  "extra-set",
  "more-weight",
] as const;

export interface ExerciseExposureInput {
  exerciseId: string;
  prescription: ExercisePrescription;
  reps: readonly number[];
  rirs: readonly number[];
  pain: number;
  technique: readonly TechniqueQuality[];
  consecutiveSuccessfulExposures: number;
  upperBody: boolean;
  nextDayBackToBaseline?: boolean;
  neurologicalSymptoms?: boolean;
  radiatingPain?: boolean;
  strengthLoss?: boolean;
}

const average = (values: readonly number[]) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;

const decision = (
  input: ExerciseExposureInput,
  action: ProgressionDecision["action"],
  rule: string,
  reason: string,
  output: ExercisePrescription,
): ProgressionDecision => ({
  id: `decision-${input.exerciseId}-${Date.now()}`,
  exerciseId: input.exerciseId,
  date: new Date().toISOString(),
  action,
  rule,
  reason,
  inputs: { ...input },
  previousPrescription: input.prescription,
  outputPrescription: output,
});

export function evaluateExerciseProgression(input: ExerciseExposureInput): ProgressionDecision {
  const min = input.prescription.repRange?.[0] ?? 0;
  const max = input.prescription.repRange?.[1] ?? Number.POSITIVE_INFINITY;
  const avgRir = average(input.rirs);
  const stable = input.technique.every((quality) => quality === "stable");
  const stopped = input.technique.some((quality) => quality === "stopped");

  if (
    input.neurologicalSymptoms ||
    input.radiatingPain ||
    input.strengthLoss ||
    input.pain > 3 ||
    stopped
  ) {
    return decision(
      input,
      "stop",
      "SAFETY_HARD_STOP",
      "Sintomi incompatibili con una progressione: esercizio interrotto e zona non allenata.",
      { ...input.prescription, sets: 0 },
    );
  }

  if (input.pain === 3) {
    return decision(
      input,
      "substitute",
      "LOCAL_PAIN_3",
      "Dolore 3/10: usa la prima variante facilitata, riduci il ROM o elimina una serie.",
      {
        ...input.prescription,
        sets: Math.max(1, input.prescription.sets - 1),
        rangeOfMotion: "ridotto e asintomatico",
        difficultyLevel: Math.max(0, input.prescription.difficultyLevel - 1),
      },
    );
  }

  const belowMinimum = input.reps.some((reps) => reps < min);
  const unplannedFailure = input.rirs.some((rir) => rir === 0);
  const uncertain = input.technique.some((quality) => quality === "uncertain");
  const worsenedNextDay = input.nextDayBackToBaseline === false;

  if (belowMinimum || unplannedFailure || uncertain || worsenedNextDay) {
    return decision(
      input,
      "reduce",
      "PERFORMANCE_OR_RECOVERY_REGRESSION",
      "Volume ridotto del 10–20% per prestazione, tecnica o recupero non sufficienti.",
      {
        ...input.prescription,
        sets: Math.max(1, Math.floor(input.prescription.sets * 0.85)),
        targetRir: [3, 4],
      },
    );
  }

  const allAtTop = input.reps.length > 0 && input.reps.every((reps) => reps >= max);
  const eligible = allAtTop && avgRir >= 2 && stable && input.consecutiveSuccessfulExposures >= 2;

  if (eligible && input.upperBody && input.nextDayBackToBaseline !== true) {
    return decision(
      input,
      "maintain",
      "UPPER_BODY_REQUIRES_24H_RESPONSE",
      "Prestazione valida, ma serve la risposta nelle 24 ore prima di progredire.",
      input.prescription,
    );
  }

  if (eligible) {
    const nextLevel = Math.min(DIFFICULTY_LADDER.length - 1, input.prescription.difficultyLevel + 1);
    const stage = DIFFICULTY_LADDER[nextLevel];
    let output = { ...input.prescription, difficultyLevel: nextLevel };
    if (stage === "slow-eccentric") output = { ...output, tempo: "4-1-1" };
    if (stage === "pause") output = { ...output, tempo: "3-2-1" };
    if (stage === "one-and-a-half-reps") output = { ...output, variant: `${output.variant} · 1,5 reps` };
    if (stage === "extra-set") output = { ...output, sets: output.sets + 1 };
    return decision(
      input,
      "progress",
      "DOUBLE_PROGRESSION_TWO_EXPOSURES",
      `Due esposizioni solide: avanza di un solo gradino (${stage}).`,
      output,
    );
  }

  return decision(
    input,
    "maintain",
    "IN_RANGE_MAINTAIN",
    "Ripetizioni, RIR, dolore e tecnica sono nel range: prescrizione mantenuta.",
    input.prescription,
  );
}

export interface DailyAdjustment {
  hardStopUpperBody: boolean;
  volumeMultiplier: number;
  removeMainExerciseSets: number;
  targetRir: [number, number];
  convertQualityRunToEasy: boolean;
  facilitatedVariantsOnly: boolean;
  reasons: string[];
}

export function adjustForReadiness(readiness: DailyReadiness): DailyAdjustment {
  const reasons: string[] = [];
  const neurological = readiness.armNeurologicalSymptoms || readiness.coordinationWorsened;
  let volumeMultiplier = 1;
  let removeMainExerciseSets = 0;
  let targetRir: [number, number] = [2, 3];

  if (readiness.energy === 1 || readiness.sleep === 1) {
    volumeMultiplier = 0.7;
    targetRir = [3, 4];
    reasons.push("Energia o sonno 1/5: serie ridotte del 30% e RIR 3–4.");
  } else if (readiness.energy === 2 || readiness.sleep === 2) {
    removeMainExerciseSets = 1;
    reasons.push("Energia o sonno 2/5: una serie in meno negli esercizi principali.");
  }

  if (readiness.legSoreness >= 7) reasons.push("Gambe ≥7/10: lower body ridotto e corsa intensa convertita in facile.");
  if (readiness.shoulderPain === 3 || readiness.cervicalPain === 3)
    reasons.push("Dolore locale 3/10: solo variante facilitata previa conferma.");
  if (neurological) reasons.push("Sintomo neurologico segnalato: stop per l’upper body.");

  return {
    hardStopUpperBody: neurological,
    volumeMultiplier,
    removeMainExerciseSets,
    targetRir,
    convertQualityRunToEasy: readiness.legSoreness >= 7,
    facilitatedVariantsOnly: readiness.shoulderPain === 3 || readiness.cervicalPain === 3,
    reasons,
  };
}

export interface FatigueSignal {
  performanceDropPercent?: number;
  sessionRpe?: number;
  recovery?: number;
  persistentSymptoms?: boolean;
  incompleteSessions?: number;
}

export function evaluateDeload(week: number, consecutiveSessions: FatigueSignal[]): DeloadDecision {
  if (week === 8) {
    return {
      id: `deload-week-8`,
      date: new Date().toISOString(),
      scheduled: true,
      reason: "Settimana 8: deload programmato, entrambe le corse facili.",
      volumeMultiplier: 0.55,
      targetRir: [3, 4],
    };
  }
  const flagged = consecutiveSessions.slice(-2).filter((signal) =>
    (signal.performanceDropPercent ?? 0) >= 10 ||
    (signal.sessionRpe ?? 0) >= 9 ||
    signal.recovery === 1 ||
    signal.persistentSymptoms ||
    (signal.incompleteSessions ?? 0) >= 2,
  );
  return {
    id: `deload-${Date.now()}`,
    date: new Date().toISOString(),
    scheduled: flagged.length === 2,
    reason:
      flagged.length === 2
        ? "Due sedute consecutive mostrano segnali di fatica: suggerito deload anticipato."
        : "Nessun criterio consecutivo sufficiente per un deload anticipato.",
    volumeMultiplier: flagged.length === 2 ? 0.6 : 1,
    targetRir: flagged.length === 2 ? [3, 4] : [2, 3],
  };
}

export const isSundayFree = (date: Date) => date.getDay() === 0;

export function rescheduleSkippedRun(preferredDate: Date): Date | null {
  return isSundayFree(preferredDate) ? null : preferredDate;
}

export function capWeeklyRunMinutes(previousMinutes: number, proposedMinutes: number): number {
  return Math.min(proposedMinutes, Math.round(previousMinutes * 1.1));
}

export function undoProgressionDecision(decisionValue: ProgressionDecision, undoneAt = new Date().toISOString()) {
  return {
    decision: { ...decisionValue, undoneAt },
    restoredPrescription: decisionValue.previousPrescription,
  };
}
