import type { CoachReview, ProgressionDecision, RunCalibrationDecision, RunSession, WorkoutSession } from "./types";

export interface TrainingSnapshot {
  week: number;
  blockWeeks: number;
  workouts: Array<{
    date: string;
    template: string;
    durationMinutes?: number;
    sessionRpe?: number;
    setsLogged: number;
    weights: Array<{ reps?: number; rir: number; weightKg: number; dumbbells: number }>;
    feeling?: string;
  }>;
  runs: Array<{
    date: string;
    type: string;
    durationMinutes: number;
    distanceKm?: number;
    rpe: number;
    symptomsDuring: number;
    conversionReason?: string;
  }>;
  progressionDecisions: ProgressionDecision[];
  runCalibrations: RunCalibrationDecision[];
  readinessSummary?: {
    avgEnergy: number;
    avgLegSoreness: number;
    maxShoulderPain: number;
  };
}

export function buildTrainingSnapshot(input: {
  week: number;
  workouts: WorkoutSession[];
  runs: RunSession[];
  progressionDecisions: ProgressionDecision[];
  runCalibrations: RunCalibrationDecision[];
  templateNames: Record<string, string>;
}): TrainingSnapshot {
  return {
    week: input.week,
    blockWeeks: 8,
    workouts: input.workouts.map((session) => ({
      date: session.date,
      template: input.templateNames[session.templateId] ?? session.templateId,
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
    })),
    runs: input.runs.map((run) => ({
      date: run.date,
      type: run.type,
      durationMinutes: run.durationMinutes,
      distanceKm: run.distanceKm,
      rpe: run.rpe,
      symptomsDuring: run.symptomsDuring,
      conversionReason: run.conversionReason,
    })),
    progressionDecisions: input.progressionDecisions,
    runCalibrations: input.runCalibrations,
  };
}

export function deterministicCoachReview(snapshot: TrainingSnapshot): CoachReview {
  const lastRun = snapshot.runs.at(-1);
  const lastWorkout = snapshot.workouts.at(-1);
  const runNotes: string[] = [];
  const strengthNotes: string[] = [];

  if (lastRun) {
    runNotes.push(
      `Ultima corsa: ${lastRun.durationMinutes} min, RPE ${lastRun.rpe}, tipo ${lastRun.type}.`,
    );
  }
  if (lastWorkout) {
    strengthNotes.push(
      `Ultima seduta ${lastWorkout.template}: ${lastWorkout.setsLogged} serie registrate, RPE ${lastWorkout.sessionRpe ?? "—"}.`,
    );
  }
  for (const calibration of snapshot.runCalibrations.slice(-2)) {
    runNotes.push(calibration.reason);
  }
  for (const decision of snapshot.progressionDecisions.filter((entry) => !entry.undoneAt).slice(-3)) {
    strengthNotes.push(decision.reason);
  }

  return {
    id: `coach-local-${snapshot.week}-${Date.now()}`,
    date: new Date().toISOString(),
    week: snapshot.week,
    summary: "Revisione deterministica basata su log e regole Assetto.",
    strengthNotes: strengthNotes.length ? strengthNotes : ["Continua a registrare peso, ripetizioni e RIR per ogni serie."],
    runNotes: runNotes.length ? runNotes : ["Registra durata e RPE dopo ogni corsa per calibrare il sabato."],
    nextWeekFocus: [
      "Upper body: attendi la risposta 24h prima di progredire.",
      "Corsa: rispetta il tetto settimanale +10%.",
      snapshot.week >= 7 ? "Settimana 8: deload programmato." : "Mantieni la tecnica stabile prima di aumentare il carico.",
    ],
    source: "deterministic",
  };
}

export const COACH_SYSTEM_PROMPT = `Sei un coach di allenamento ibrido (ipertrofia domestica + corsa) per l'app Assetto.
Regole vincolanti:
- Non formulare diagnosi mediche.
- Rispetta i limiti cervicali e di spalla dell'atleta.
- La progressione forza segue RIR, dolore e tecnica; l'upper body richiede risposta 24h.
- La corsa non recupera mai il volume saltato la domenica; crescita settimanale max +10%.
- Se martedì la corsa è più corta del previsto, sabato si calibra in modo prudente, mai con recupero aggressivo.
Rispondi SOLO in JSON valido con questa struttura:
{
  "summary": "stringa breve",
  "strengthNotes": ["..."],
  "runNotes": ["..."],
  "nextWeekFocus": ["..."]
}`;

export function parseCoachResponse(content: string, week: number): CoachReview {
  const jsonStart = content.indexOf("{");
  const jsonEnd = content.lastIndexOf("}");
  const payload = JSON.parse(content.slice(jsonStart, jsonEnd + 1)) as {
    summary: string;
    strengthNotes: string[];
    runNotes: string[];
    nextWeekFocus: string[];
  };

  return {
    id: `coach-${week}-${Date.now()}`,
    date: new Date().toISOString(),
    week,
    summary: payload.summary,
    strengthNotes: payload.strengthNotes,
    runNotes: payload.runNotes,
    nextWeekFocus: payload.nextWeekFocus,
    source: "openai",
  };
}

export const AI_SETTINGS_KEY = "assetto-ai-settings";

export interface LocalAiSettings {
  apiKey?: string;
  enabled: boolean;
  model: string;
}

export function loadLocalAiSettings(): LocalAiSettings {
  if (typeof window === "undefined") {
    return { enabled: false, model: "gpt-4.1-mini" };
  }
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY);
    if (!raw) return { enabled: false, model: "gpt-4.1-mini" };
    return JSON.parse(raw) as LocalAiSettings;
  } catch {
    return { enabled: false, model: "gpt-4.1-mini" };
  }
}

export function saveLocalAiSettings(settings: LocalAiSettings) {
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
}
