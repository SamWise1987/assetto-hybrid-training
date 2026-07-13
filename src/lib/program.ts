import type {
  ExerciseDefinition,
  ExercisePrescription,
  RunSession,
  TrainingBlock,
  UserProfile,
  WorkoutSession,
  WorkoutTemplate,
  ProgressionDecision,
  DailyReadiness,
  Equipment,
  ClinicalSafetyProfile,
} from "./types";

const prescription = (
  id: string,
  exerciseId: string,
  sets: number,
  repRange: [number, number],
  targetRir: [number, number] = [2, 3],
  variant = "standard",
): ExercisePrescription => ({
  id,
  exerciseId,
  sets,
  repRange,
  targetRir,
  variant,
  tempo: "2-0-1",
  rangeOfMotion: "completo e confortevole",
  difficultyLevel: 0,
});

export const EXERCISES: ExerciseDefinition[] = [
  { id: "bulgarian-split-squat", name: "Bulgarian split squat", pattern: "squat", muscleGroups: ["quadricipiti", "glutei"], unilateral: true, defaultRepRange: [8, 12], substitutions: ["split squat con un manubrio", "split squat a corpo libero"] },
  { id: "floor-press", name: "Floor press presa neutra", pattern: "spinta orizzontale", muscleGroups: ["petto", "tricipiti"], upperBody: true, defaultRepRange: [8, 15], substitutions: ["push-up su piano rialzato", "push-up sulle ginocchia", "esercizio saltato"], safetyNotes: ["Non cercare il cedimento", "Interrompere se compaiono sintomi al braccio"] },
  { id: "supported-row", name: "Rematore a un braccio supportato", pattern: "tirata orizzontale", muscleGroups: ["dorso", "bicipiti"], unilateral: true, upperBody: true, defaultRepRange: [10, 15], substitutions: ["busto più verticale e maggiore supporto", "meno serie", "esercizio saltato"] },
  { id: "rdl", name: "Romanian deadlift", pattern: "hinge", muscleGroups: ["femorali", "glutei"], defaultRepRange: [8, 15], substitutions: ["B-stance RDL", "single-leg RDL"] },
  { id: "calf-raise", name: "Calf raise", pattern: "polpacci", muscleGroups: ["polpacci"], defaultRepRange: [15, 25], substitutions: ["calf raise a una gamba"] },
  { id: "dead-bug", name: "Dead bug", pattern: "core anti-estensione", muscleGroups: ["core"], unilateral: true, defaultRepRange: [8, 12], substitutions: [] },
  { id: "reverse-lunge", name: "Affondo indietro", pattern: "squat", muscleGroups: ["quadricipiti", "glutei"], unilateral: true, defaultRepRange: [10, 15], substitutions: ["affondo assistito", "corpo libero"] },
  { id: "hip-thrust", name: "Hip thrust / ponte glutei", pattern: "estensione anca", muscleGroups: ["glutei"], defaultRepRange: [10, 20], substitutions: ["ponte glutei a corpo libero"] },
  { id: "handle-push-up", name: "Flessioni sugli handle", pattern: "spinta orizzontale", muscleGroups: ["petto", "tricipiti"], upperBody: true, defaultRepRange: [6, 20], substitutions: ["ROM ridotto", "piano rialzato", "esercizio saltato"] },
  { id: "prone-w", name: "Prone W senza peso", pattern: "controllo scapolare", muscleGroups: ["dorso", "spalle"], upperBody: true, defaultRepRange: [8, 12], substitutions: ["esercizio saltato"] },
  { id: "side-plank", name: "Side plank", pattern: "core anti-flessione", muscleGroups: ["core"], unilateral: true, defaultSecondsRange: [20, 45], substitutions: ["side plank dalle ginocchia"] },
  { id: "single-leg-glute-bridge", name: "Ponte glutei a una gamba", pattern: "estensione anca", muscleGroups: ["glutei"], unilateral: true, defaultRepRange: [12, 20], substitutions: ["ponte glutei bilaterale"] },
  { id: "bird-dog", name: "Bird dog", pattern: "core anti-rotazione", muscleGroups: ["core"], unilateral: true, defaultRepRange: [6, 10], substitutions: [] },
];

export const WARMUP = [
  "Marcia o camminata veloce · 3 min",
  "Squat a corpo libero · 10",
  "Hip hinge senza peso · 10",
  "Retrazione cervicale delicata · 6–8, solo se asintomatica",
  "Push-up scapolare alla parete · 2 × 10",
  "Rotazione esterna isometrica alla parete · 2 × 20–30 s",
];

export const TEMPLATES: WorkoutTemplate[] = [
  {
    id: "strength-a", dayOfWeek: 1, name: "Forza A", kind: "strength", estimatedMinutes: 48,
    prescriptions: [
      prescription("a1", "bulgarian-split-squat", 3, [8, 12]),
      prescription("a2", "floor-press", 3, [8, 15]),
      prescription("a3", "supported-row", 3, [10, 15]),
      prescription("a4", "rdl", 3, [8, 15]),
      prescription("a5", "calf-raise", 3, [15, 25]),
      prescription("a6", "dead-bug", 3, [8, 12]),
    ],
  },
  { id: "easy-run", dayOfWeek: 2, name: "Corsa facile", kind: "run", estimatedMinutes: 42, prescriptions: [], notes: ["35–50 min", "RPE 3–4", "Talk test: frasi complete"] },
  {
    id: "strength-b", dayOfWeek: 3, name: "Forza B", kind: "strength", estimatedMinutes: 52,
    prescriptions: [
      prescription("b1", "reverse-lunge", 3, [10, 15]),
      prescription("b2", "hip-thrust", 4, [10, 20]),
      prescription("b3", "handle-push-up", 3, [6, 20]),
      prescription("b4", "supported-row", 4, [8, 12]),
      prescription("b5", "prone-w", 2, [8, 12]),
      { ...prescription("b6", "side-plank", 3, [20, 45]), repRange: undefined, secondsRange: [20, 45] },
    ],
  },
  { id: "recovery", dayOfWeek: 4, name: "Recupero facoltativo", kind: "recovery", estimatedMinutes: 0, prescriptions: [], notes: ["Riposo, passeggiata libera o mobilità non provocativa. Nessun obbligo."] },
  {
    id: "strength-c", dayOfWeek: 5, name: "Forza C", kind: "strength", estimatedMinutes: 44,
    prescriptions: [
      prescription("c1", "floor-press", 3, [10, 20]),
      prescription("c2", "supported-row", 3, [12, 20]),
      prescription("c3", "bulgarian-split-squat", 2, [12, 15], [3, 3], "carico moderato"),
      prescription("c4", "rdl", 2, [10, 12], [3, 3], "B-stance moderato"),
      prescription("c5", "single-leg-glute-bridge", 2, [12, 20]),
      prescription("c6", "calf-raise", 2, [15, 25], [3, 3], "una gamba"),
      prescription("c7", "bird-dog", 3, [6, 10]),
    ],
    notes: ["Lower body sempre a RIR 3 per proteggere la corsa del sabato."],
  },
  { id: "main-run", dayOfWeek: 6, name: "Corsa principale", kind: "run", estimatedMinutes: 55, prescriptions: [], notes: ["Alterna lungo facile e qualità controllata", "Settimane 1–2 sempre facili"] },
  { id: "sunday-free", dayOfWeek: 0, name: "Domenica libera", kind: "free", estimatedMinutes: 0, prescriptions: [] },
];

export const PROFILE: UserProfile = {
  id: "local-user",
  name: "Atleta",
  birthYear: 1992,
  primaryGoal: "hypertrophy",
  secondaryGoals: ["forma cardiovascolare", "controllo massa grassa"],
  createdAt: "2026-06-22T08:00:00.000Z",
};

export const EQUIPMENT: Equipment[] = [
  { id: "db-16", label: "Manubrio fisso 16 kg", kind: "fixed-dumbbell", weightKg: 16, quantity: 2 },
  { id: "pushup-handles", label: "Handle per flessioni", kind: "push-up-handle", quantity: 2 },
  { id: "bodyweight", label: "Corpo libero", kind: "bodyweight", quantity: 1 },
];

export const SAFETY_PROFILE: ClinicalSafetyProfile = {
  id: "safety-local-user",
  limitations: ["Protrusioni cervicali C4–C7", "Conflitto subacromiale destro", "Lieve tendinopatia del sovraspinoso destro"],
  excludedExercises: ["military press", "pike push-up", "dip", "upright row", "pullover", "scrollate pesanti", "farmer walk pesanti", "burpee ad alto volume", "ponti cervicali", "carichi sul collo"],
};

export const BLOCK: TrainingBlock = {
  id: "block-1",
  startDate: "2026-06-22",
  week: 4,
  durationWeeks: 8,
  status: "active",
};

const demoReadiness: DailyReadiness[] = [
  { id: "ready-w1", date: "2026-06-22", energy: 4, sleep: 4, legSoreness: 2, shoulderPain: 1, cervicalPain: 1, armNeurologicalSymptoms: false, coordinationWorsened: false, recovery: 4 },
  { id: "ready-w2", date: "2026-06-29", energy: 4, sleep: 3, legSoreness: 3, shoulderPain: 1, cervicalPain: 1, armNeurologicalSymptoms: false, coordinationWorsened: false, recovery: 4 },
  { id: "ready-w3", date: "2026-07-06", energy: 2, sleep: 2, legSoreness: 7, shoulderPain: 3, cervicalPain: 1, armNeurologicalSymptoms: false, coordinationWorsened: false, recovery: 2 },
];

const demoSessions: WorkoutSession[] = [
  { id: "session-w1-a", templateId: "strength-a", date: "2026-06-22", status: "complete", readinessId: "ready-w1", setLogs: [], sessionRpe: 7, durationMinutes: 45, shoulderPainAfter: 1, cervicalPainAfter: 1, modifiedExerciseIds: [], skippedExerciseIds: [], generalFeeling: "better" },
  { id: "session-w2-a", templateId: "strength-a", date: "2026-06-29", status: "complete", readinessId: "ready-w2", setLogs: [], sessionRpe: 7, durationMinutes: 47, shoulderPainAfter: 1, cervicalPainAfter: 1, modifiedExerciseIds: [], skippedExerciseIds: [], generalFeeling: "same" },
  { id: "session-w3-a", templateId: "strength-a", date: "2026-07-06", status: "complete", readinessId: "ready-w3", setLogs: [], sessionRpe: 8, durationMinutes: 41, shoulderPainAfter: 2, cervicalPainAfter: 1, modifiedExerciseIds: ["floor-press"], skippedExerciseIds: [], generalFeeling: "worse" },
];

const demoRuns: RunSession[] = [
  { id: "run-1", date: "2026-06-23", type: "easy", status: "complete", durationMinutes: 36, distanceKm: 5.1, averagePace: "7:04", rpe: 3, talkTest: "full-sentences", symptomsDuring: 0, symptomsNextDay: 0 },
  { id: "run-2", date: "2026-06-27", type: "long-easy", status: "complete", durationMinutes: 48, distanceKm: 6.7, averagePace: "7:10", rpe: 4, talkTest: "full-sentences", symptomsDuring: 0, symptomsNextDay: 0 },
  { id: "run-3", date: "2026-06-30", type: "easy", status: "complete", durationMinutes: 40, distanceKm: 5.7, averagePace: "7:01", rpe: 3, talkTest: "full-sentences", symptomsDuring: 0, symptomsNextDay: 0 },
  { id: "run-4", date: "2026-07-04", type: "controlled-quality", status: "complete", durationMinutes: 50, distanceKm: 7.5, averagePace: "6:40", rpe: 7, talkTest: "short-phrases", symptomsDuring: 0, symptomsNextDay: 0 },
  { id: "run-5", date: "2026-07-07", type: "easy", status: "complete", durationMinutes: 38, distanceKm: 5.3, averagePace: "7:10", rpe: 4, talkTest: "full-sentences", symptomsDuring: 0, symptomsNextDay: 0 },
  { id: "run-6", date: "2026-07-11", type: "easy", status: "complete", durationMinutes: 44, distanceKm: 6.1, averagePace: "7:13", rpe: 4, talkTest: "full-sentences", symptomsDuring: 0, symptomsNextDay: 0, conversionReason: "Corsa intensa convertita in facile: gambe affaticate 7/10 dopo venerdì." },
];

const demoDecisions: ProgressionDecision[] = [
  { id: "decision-progress", exerciseId: "floor-press", date: "2026-07-12", action: "progress", rule: "DOUBLE_PROGRESSION_TWO_EXPOSURES", reason: "Una serie in più sul floor press: due esposizioni solide.", inputs: { exposures: 2, avgRir: 2.5, pain: 1 }, previousPrescription: TEMPLATES[0].prescriptions[1], outputPrescription: { ...TEMPLATES[0].prescriptions[1], sets: 4 } },
  { id: "decision-maintain", exerciseId: "supported-row", date: "2026-07-01", action: "maintain", rule: "IN_RANGE_MAINTAIN", reason: "Rematore mantenuto: ripetizioni e RIR nel range.", inputs: { avgRir: 2 }, previousPrescription: TEMPLATES[0].prescriptions[2], outputPrescription: TEMPLATES[0].prescriptions[2] },
  { id: "decision-reduce", exerciseId: "rdl", date: "2026-07-06", action: "reduce", rule: "UNPLANNED_RIR_ZERO", reason: "RDL ridotto: RIR 0 non pianificato nell’ultima serie.", inputs: { rir: 0 }, previousPrescription: TEMPLATES[0].prescriptions[3], outputPrescription: { ...TEMPLATES[0].prescriptions[3], sets: 2, targetRir: [3, 4] } },
  { id: "decision-substitute", exerciseId: "floor-press", date: "2026-07-06", action: "substitute", rule: "LOCAL_PAIN_3", reason: "Floor press sostituito con push-up rialzato per dolore 3/10.", inputs: { pain: 3 }, previousPrescription: TEMPLATES[0].prescriptions[1], outputPrescription: { ...TEMPLATES[0].prescriptions[1], variant: "push-up su piano rialzato", sets: 2 } },
];

export const DEMO_SEED = {
  profile: PROFILE,
  equipment: EQUIPMENT,
  safetyProfile: SAFETY_PROFILE,
  block: BLOCK,
  exercises: EXERCISES,
  templates: TEMPLATES,
  readiness: demoReadiness,
  workoutSessions: demoSessions,
  runs: demoRuns,
  decisions: demoDecisions,
};

export function getTemplateForDay(day: number) {
  return TEMPLATES.find((template) => template.dayOfWeek === day) ?? TEMPLATES[0];
}

export function getCycleTargets(week: number) {
  if (week <= 2) return { setCap: 2, targetRir: [3, 4] as [number, number], runsEasyOnly: true, deload: false };
  if (week <= 4) return { setCap: undefined, targetRir: [2, 3] as [number, number], runsEasyOnly: false, deload: false };
  if (week <= 7) return { setCap: undefined, targetRir: [1, 2] as [number, number], runsEasyOnly: false, deload: false };
  return { setCap: undefined, targetRir: [3, 4] as [number, number], runsEasyOnly: true, deload: true };
}
