export type Id = string;
export type Side = "left" | "right" | "bilateral";
export type TechniqueQuality = "stable" | "uncertain" | "stopped";
export type SessionKind = "strength" | "run" | "recovery" | "free";
export type DecisionAction = "progress" | "maintain" | "reduce" | "substitute" | "stop";

export type UserRole = "admin" | "coach" | "athlete";

export interface AccountProfile {
  id: Id;
  userId: Id;
  email: string;
  displayName: string;
  role: UserRole;
  updatedAt: string;
}

export interface TemplateCustomization {
  id: Id;
  templateId: Id;
  name: string;
  notes?: string[];
  estimatedMinutes?: number;
  updatedAt: string;
  updatedBy?: string;
}

export interface TrainingPlan {
  id: Id;
  name: string;
  description?: string;
  sessions: TrainingPlanSession[];
  createdBy: Id;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingPlanSession {
  templateId: Id;
  dayOfWeek: number;
  displayName: string;
  kind: SessionKind;
  estimatedMinutes: number;
  notes?: string[];
}

export interface PlanAssignment {
  id: Id;
  planId: Id;
  athleteEmail: string;
  athleteUserId?: Id;
  assignedBy: Id;
  assignedAt: string;
  active: boolean;
}

export interface UserProfile {
  id: Id;
  name: string;
  birthYear: number;
  primaryGoal: "hypertrophy";
  secondaryGoals: string[];
  createdAt: string;
}

export interface Equipment {
  id: Id;
  label: string;
  kind: "fixed-dumbbell" | "push-up-handle" | "bodyweight";
  weightKg?: number;
  quantity: number;
}

export interface ClinicalSafetyProfile {
  id: Id;
  limitations: string[];
  excludedExercises: string[];
  disclaimerAcceptedAt?: string;
}

export interface TrainingBlock {
  id: Id;
  startDate: string;
  week: number;
  durationWeeks: 8;
  status: "active" | "complete";
}

export interface ExerciseDefinition {
  id: Id;
  name: string;
  pattern: string;
  muscleGroups: string[];
  unilateral?: boolean;
  upperBody?: boolean;
  defaultRepRange?: [number, number];
  defaultSecondsRange?: [number, number];
  substitutions: string[];
  safetyNotes?: string[];
}

export interface ExercisePrescription {
  id: Id;
  exerciseId: Id;
  sets: number;
  repRange?: [number, number];
  secondsRange?: [number, number];
  targetRir: [number, number];
  variant: string;
  tempo: string;
  rangeOfMotion: string;
  difficultyLevel: number;
}

export interface WorkoutTemplate {
  id: Id;
  dayOfWeek: number;
  name: string;
  kind: SessionKind;
  estimatedMinutes: number;
  prescriptions: ExercisePrescription[];
  notes?: string[];
}

export interface DailyReadiness {
  id: Id;
  date: string;
  energy: 1 | 2 | 3 | 4 | 5;
  sleep: 1 | 2 | 3 | 4 | 5;
  legSoreness: number;
  shoulderPain: number;
  cervicalPain: number;
  armNeurologicalSymptoms: boolean;
  coordinationWorsened: boolean;
  recovery?: 1 | 2 | 3 | 4 | 5;
}

export interface SetLog {
  id: Id;
  sessionId: Id;
  prescriptionId: Id;
  setNumber: number;
  weightPerDumbbellKg: number;
  dumbbellCount: number;
  side: Side;
  reps?: number;
  seconds?: number;
  rir: 0 | 1 | 2 | 3 | 4 | 5;
  shoulderPain: number;
  cervicalSymptoms: number;
  technique: TechniqueQuality;
  variant: string;
  tempo: string;
  rangeOfMotion: string;
  notes?: string;
  confirmedAt: string;
}

export interface WorkoutSession {
  id: Id;
  templateId: Id;
  date: string;
  status: "planned" | "in-progress" | "complete" | "skipped" | "stopped";
  readinessId?: Id;
  setLogs: SetLog[];
  sessionRpe?: number;
  durationMinutes?: number;
  shoulderPainAfter?: number;
  cervicalPainAfter?: number;
  modifiedExerciseIds: Id[];
  skippedExerciseIds: Id[];
  generalFeeling?: "better" | "same" | "worse";
}

export interface RunSession {
  id: Id;
  date: string;
  type: "easy" | "long-easy" | "controlled-quality" | "walk";
  status: "complete" | "skipped" | "stopped";
  durationMinutes: number;
  distanceKm?: number;
  averagePace?: string;
  rpe: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  talkTest: "full-sentences" | "short-phrases" | "failed";
  symptomsDuring: number;
  symptomsNextDay?: number;
  conversionReason?: string;
}

export interface NextDayResponse {
  id: Id;
  sessionId: Id;
  date: string;
  shoulderBackToBaseline: boolean;
  cervicalBackToBaseline: boolean;
  perceivedRecovery: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export interface ProgressionDecision {
  id: Id;
  exerciseId: Id;
  date: string;
  action: DecisionAction;
  rule: string;
  reason: string;
  inputs: Record<string, unknown>;
  previousPrescription: ExercisePrescription;
  outputPrescription: ExercisePrescription;
  undoneAt?: string;
}

export interface DeloadDecision {
  id: Id;
  date: string;
  scheduled: boolean;
  reason: string;
  volumeMultiplier: number;
  targetRir: [number, number];
}

export interface ActivePrescription {
  id: Id;
  exerciseId: Id;
  templateId: Id;
  prescription: ExercisePrescription;
  updatedAt: string;
}

export interface RunPlan {
  id: Id;
  date: string;
  dayOfWeek: number;
  week: number;
  type: RunSession["type"];
  durationMinutes: number;
  status: "planned" | "completed" | "calibrated";
  sourceRunId?: Id;
  notes?: string[];
}

export interface RunCalibrationDecision {
  id: Id;
  date: string;
  targetDate: string;
  targetDayOfWeek: number;
  rule: string;
  reason: string;
  inputs: Record<string, unknown>;
  previousPlan: Pick<RunPlan, "type" | "durationMinutes">;
  outputPlan: Pick<RunPlan, "type" | "durationMinutes">;
  undoneAt?: string;
}

export interface AppSettings {
  id: "app-settings";
  aiCoachEnabled: boolean;
  aiModel: string;
  lastCoachReviewAt?: string;
}

export interface CoachReview {
  id: Id;
  date: string;
  week: number;
  summary: string;
  strengthNotes: string[];
  runNotes: string[];
  nextWeekFocus: string[];
  source: "openai" | "deterministic";
}
