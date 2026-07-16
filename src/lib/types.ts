export type Id = string;
export type Side = "left" | "right" | "bilateral";
export type TechniqueQuality = "stable" | "uncertain" | "stopped";
export type SessionKind = "strength" | "run" | "recovery" | "free";
export type DecisionAction = "progress" | "maintain" | "reduce" | "substitute" | "stop";

export type UserRole = "admin" | "coach" | "athlete";
export type PlatformSource = "web" | "ios" | "android";
export type WorkoutDataSource = "app" | "apple_health" | "health_connect" | "gpx" | "strava";

export interface AccountProfile {
  id: Id;
  userId: Id;
  email: string;
  displayName: string;
  role: UserRole;
  updatedAt: string;
}

export interface AthleteProfile {
  id: Id;
  userId: Id;
  displayName: string;
  birthYear?: number;
  primaryGoal: string;
  secondaryGoals: string[];
  trainingDays: number[];
  equipment: string[];
  limitations: string[];
  onboardingCompletedAt?: string;
  healthOnboardingSkippedAt?: string;
  consentAcceptedAt?: string;
  consentVersion?: string;
  updatedAt: string;
}

export interface TrainerClient {
  id: Id;
  trainerUserId: Id;
  athleteUserId?: Id;
  athleteEmail: string;
  status: "invited" | "active" | "archived";
  invitedAt: string;
  acceptedAt?: string;
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
  runSessions?: TrainingPlanRunSession[];
  createdBy: Id;
  createdAt: string;
  updatedAt: string;
  version?: number;
  changeReason?: string;
  versionCreatedAt?: string;
}

export interface TrainingPlanRunSession {
  dayOfWeek: number;
  type: RunSession["type"];
  durationMinutes: number;
  notes?: string[];
  workoutTemplateId?: Id;
  segments?: RunningWorkoutSegment[];
}

export interface TrainingPlanSession {
  templateId: Id;
  dayOfWeek: number;
  displayName: string;
  kind: SessionKind;
  estimatedMinutes: number;
  notes?: string[];
  prescriptions?: ExercisePrescription[];
  runConfig?: {
    type: RunSession["type"];
    durationMinutes: number;
    notes?: string[];
    workoutTemplateId?: Id;
    segments?: RunningWorkoutSegment[];
  };
}

export type RunSessionSource = "manual" | "strava" | "gpx" | "apple_health" | "health_connect";

export interface ConnectedService {
  id: Id;
  provider: "strava" | "garmin" | "apple_health" | "health_connect";
  athleteId?: string;
  connectedAt: string;
  lastSyncAt?: string;
  scopes?: string[];
}

export type ExternalWorkoutKind = "run" | "walk" | "strength" | "other";

export interface ExternalWorkout {
  id: Id;
  userId?: Id;
  externalId: string;
  source: Exclude<WorkoutDataSource, "app">;
  platform: PlatformSource;
  workoutType: string;
  kind: ExternalWorkoutKind;
  startDate: string;
  endDate: string;
  durationMinutes: number;
  distanceKm?: number;
  caloriesKcal?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  sourceName?: string;
  matchedTemplateId?: Id;
  matchedAt?: string;
  importedAt: string;
  syncedAt?: string;
}

export interface HealthSyncState {
  id: Id;
  userId?: Id;
  platform: PlatformSource;
  status: "never" | "syncing" | "success" | "denied" | "error";
  lastAttemptAt?: string;
  lastSuccessfulSyncAt?: string;
  lastImportedCount: number;
  lastSkippedCount: number;
  errorMessage?: string;
}

export interface RunningWorkoutSegment {
  id: Id;
  phase: "warmup" | "work" | "recovery" | "cooldown";
  repeats?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  targetRpe?: [number, number];
  targetPace?: string;
  targetHeartRateZone?: string;
  instructions: string;
}

export interface RunningWorkoutTemplate {
  id: Id;
  name: string;
  category: "easy" | "long" | "tempo" | "intervals" | "hills" | "recovery";
  level: "beginner" | "intermediate" | "advanced";
  objective: string;
  estimatedMinutes: number;
  safetyNotes: string[];
  segments: RunningWorkoutSegment[];
  createdBy?: Id;
  updatedAt: string;
}

export interface PlanVersion {
  id: Id;
  planId: Id;
  version: number;
  snapshot: TrainingPlan;
  reason: string;
  createdBy: Id;
  createdAt: string;
}

export type SuggestionStatus = "proposed" | "approved" | "modified" | "applied" | "rejected" | "undone";

export interface AnalysisSuggestion {
  id: Id;
  athleteUserId: Id;
  title: string;
  rationale: string;
  evidence: string[];
  proposedChange: Record<string, unknown>;
  status: SuggestionStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: Id;
}

export interface AppNotification {
  id: Id;
  recipientUserId?: Id;
  actorUserId?: Id;
  type: "invite" | "plan_assigned" | "plan_updated" | "suggestion" | "workout_completed" | "run_completed" | "external_workout_completed" | "follow_up" | "safety" | "sync_error" | "health_issue";
  title: string;
  body: string;
  href?: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
  readAt?: string;
}

export interface SyncQueueItem {
  id: Id;
  entity: "profile" | "workout" | "run" | "external_workout" | "readiness" | "follow_up" | "notification_read";
  entityId: Id;
  operation: "upsert" | "delete";
  payload: Record<string, unknown>;
  createdAt: string;
  attemptCount: number;
  lastError?: string;
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

export type PreferredGreeting = "benvenuto" | "benvenuta" | "neutral";

export interface UserProfile {
  id: Id;
  name: string;
  birthYear: number;
  primaryGoal: "hypertrophy";
  secondaryGoals: string[];
  preferredGreeting?: PreferredGreeting;
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
  equipment?: string[];
  description?: string;
  imageUrl?: string | null;
  category?: string;
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
  /** Pausa tra le serie in secondi */
  restSeconds?: number;
  /** Suggerimento tecnico o coaching per il cliente */
  hint?: string;
  /** Carico target per manubrio (kg), se prescritto */
  targetLoadKg?: number;
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
  startedAt?: string;
  endedAt?: string;
  sessionRpe?: number;
  durationMinutes?: number;
  /** Durata precisa in formato M:SS o H:MM:SS */
  durationPrecise?: string;
  shoulderPainAfter?: number;
  cervicalPainAfter?: number;
  modifiedExerciseIds: Id[];
  skippedExerciseIds: Id[];
  generalFeeling?: "better" | "same" | "worse";
  source?: WorkoutDataSource;
  platform?: PlatformSource;
  deviceName?: string;
  externalWorkoutId?: Id;
  syncedAt?: string;
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
  /** False when an external source did not provide RPE, talk test or symptoms. */
  subjectiveDataAvailable?: boolean;
  symptomsNextDay?: number;
  conversionReason?: string;
  source?: RunSessionSource;
  platform?: PlatformSource;
  deviceName?: string;
  externalId?: string;
  elevationGainM?: number;
  syncedAt?: string;
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
  workoutTemplateId?: Id;
  segments?: RunningWorkoutSegment[];
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
  stravaConnected?: boolean;
  lastStravaSyncAt?: string;
  localDataMigratedForUserId?: string;
  dataOwnerUserId?: string;
  onboardingVersion?: number;
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
