"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, Clock3, Footprints, Lightbulb } from "lucide-react";
import { adjustForReadiness } from "@/lib/autoregulation";
import { db, getActiveBlockWeek, getResolvedTemplates, getTodayRunPlan } from "@/lib/db";
import { getExerciseById } from "@/lib/exercise-library";
import { EXERCISES, TEMPLATES } from "@/lib/program";
import { getTemplateForDayWithOverrides } from "@/lib/training-engine";
import type { DailyReadiness, ExercisePrescription, WorkoutTemplate } from "@/lib/types";
import { canManagePlans } from "@/lib/roles";
import { useTabNavigation } from "@/lib/tab-navigation";
import { getDisplayName, getWelcomeGreeting } from "@/lib/user-display";
import { Button, Surface } from "../../ui";
import { RunFlow } from "./run-flow";
import { WorkoutFlow } from "./workout-flow";
import { NextDayPanel, CompletionPanel } from "./shared-panels";

type Mode = "overview" | "scheda" | "checkin" | "stop" | "warmup" | "workout" | "checkout" | "done" | "next-day" | "run";

const today = new Date();
const isoToday = today.toISOString().slice(0, 10);
const dateLabel = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(today);

export const makeReadiness = (): DailyReadiness => ({
  id: `readiness-${isoToday}`,
  date: isoToday,
  energy: 4,
  sleep: 3,
  legSoreness: 2,
  shoulderPain: 0,
  cervicalPain: 0,
  armNeurologicalSymptoms: false,
  coordinationWorsened: false,
});

function formatVolume(prescription: ExercisePrescription) {
  if (prescription.secondsRange) {
    return `${prescription.sets} × ${prescription.secondsRange.join("–")} s`;
  }
  return `${prescription.sets} × ${prescription.repRange?.join("–") ?? "—"}`;
}

function SchedaPanel({
  template,
  onBack,
  onStart,
}: {
  template: WorkoutTemplate;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <div className="flow-screen scheda-screen">
      <header className="flow-header">
        <button type="button" onClick={onBack} aria-label="Indietro">←</button>
        <div>
          <h1>Scheda · {template.name}</h1>
          <p>Anteprima rapida. I carichi si registrano durante la seduta.</p>
        </div>
      </header>
      <ol className="scheda-list">
        {template.prescriptions.map((prescription, index) => {
          const exercise = getExerciseById(prescription.exerciseId) ?? EXERCISES.find((entry) => entry.id === prescription.exerciseId);
          return (
            <li key={prescription.id} className="scheda-item">
              <div className="scheda-item-head">
                <span>{index + 1}</span>
                <div>
                  <strong>{exercise?.name ?? prescription.exerciseId}</strong>
                  <p>{formatVolume(prescription)}{exercise?.unilateral ? " / lato" : ""} · RIR {prescription.targetRir.join("–")}</p>
                </div>
              </div>
              {prescription.hint ? (
                <p className="scheda-hint"><Lightbulb size={16} aria-hidden="true" /> {prescription.hint}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <Button onClick={onStart}>Inizia allenamento <ArrowRight /></Button>
    </div>
  );
}

export function TodayScreen() {
  const profile = useLiveQuery(() => db.profiles.toCollection().first());
  const account = useLiveQuery(() => db.accountProfiles.toCollection().first());
  const activePrescriptions = useLiveQuery(() => db.activePrescriptions.toArray(), [], []);
  const resolvedTemplates = useLiveQuery(() => getResolvedTemplates(), [], TEMPLATES) ?? TEMPLATES;
  const latestDecision = useLiveQuery(() => db.progressionDecisions.orderBy("date").last());
  const latestRunCalibration = useLiveQuery(() => db.runCalibrationDecisions.orderBy("date").last());
  const runPlan = useLiveQuery(() => getTodayRunPlan(today), [isoToday]);
  const blockWeek = useLiveQuery(() => getActiveBlockWeek(), [], 4);
  const [mode, setMode] = useState<Mode>("overview");
  const [readiness, setReadiness] = useState(makeReadiness);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);

  const template = useMemo(
    () => getTemplateForDayWithOverrides(today.getDay(), activePrescriptions, resolvedTemplates),
    [activePrescriptions, resolvedTemplates],
  );
  const adjustment = adjustForReadiness(readiness);
  const navigateToTab = useTabNavigation();
  const displayName = getDisplayName(account, profile);
  const welcome = getWelcomeGreeting(displayName, profile?.preferredGreeting ?? "neutral");
  const isClient = !canManagePlans(account?.role);

  if (!hydrated) {
    return <div className="today-screen" aria-busy="true"><p className="quiet-note">Caricamento piano…</p></div>;
  }

  if (mode === "run") {
    return (
      <RunFlow
        plan={runPlan ?? undefined}
        onBack={() => setMode("overview")}
        onComplete={() => setMode("done")}
      />
    );
  }
  if (mode === "scheda") {
    return (
      <SchedaPanel
        template={template}
        onBack={() => setMode("overview")}
        onStart={() => setMode("checkin")}
      />
    );
  }
  if (mode === "checkin" || mode === "stop" || mode === "warmup" || mode === "workout" || mode === "checkout") {
    return (
      <WorkoutFlow
        mode={mode}
        setMode={setMode}
        template={template}
        readiness={readiness}
        setReadiness={setReadiness}
        adjustment={adjustment}
        sessionStartedAt={sessionStartedAt}
        onSessionStart={() => setSessionStartedAt(new Date().toISOString())}
      />
    );
  }
  if (mode === "done") {
    return (
      <CompletionPanel
        onHome={() => {
          setSessionStartedAt(null);
          setMode("overview");
        }}
        onProgress={() => navigateToTab("progress")}
      />
    );
  }
  if (mode === "next-day") return <NextDayPanel onBack={() => setMode("overview")} />;

  const firstPrescription = template.prescriptions[0];
  const firstExercise = getExerciseById(firstPrescription?.exerciseId ?? "") ?? EXERCISES.find((exercise) => exercise.id === firstPrescription?.exerciseId);
  const isStrength = template.kind === "strength";
  const isRun = template.kind === "run";
  const durationMinutes = runPlan?.durationMinutes ?? template.estimatedMinutes;
  const insight = latestRunCalibration?.reason ?? latestDecision?.reason;

  return (
    <div className="today-screen today-screen-minimal">
      {isClient ? (
        <p className="welcome-banner" role="status">{welcome}</p>
      ) : null}

      <section className="today-hero today-hero-compact">
        <p className="date-label">{dateLabel} · settimana {blockWeek}/8</p>
        <h1>{template.name}</h1>
        <span className="hero-rule" />
        {durationMinutes ? (
          <p className="duration"><Clock3 aria-hidden="true" /> {durationMinutes} min</p>
        ) : null}
      </section>

      {template.kind === "free" ? (
        <Surface className="session-card">
          <h2>Domenica libera</h2>
          <p>Nessuna seduta obbligatoria. Riposo o passeggiata leggera.</p>
        </Surface>
      ) : null}

      {template.kind === "recovery" ? (
        <Surface className="session-card">
          <h2>Recupero</h2>
          <p className="recovery-copy">Riposo, passeggiata libera o mobilità non provocativa. Nessun obbligo.</p>
        </Surface>
      ) : null}

      {isStrength || isRun ? (
        <Surface className="session-card">
          <p className="date-label">{isStrength ? "Allenamento di forza" : "Corsa di oggi"}</p>
          <h2>{isRun && runPlan ? `${runPlan.durationMinutes} min · ${runPlan.type === "controlled-quality" ? "qualità" : "facile"}` : template.name}</h2>
          {isStrength && firstExercise ? (
            <p>Inizia con <strong>{firstExercise.name}</strong>
              {firstPrescription?.repRange ? ` · ${firstPrescription.sets} × ${firstPrescription.repRange.join("–")}` : null}
            </p>
          ) : null}
          {isRun && runPlan?.notes?.length ? <p>{runPlan.notes[0]}</p> : null}
          {insight ? <p className="session-card-insight">{insight}</p> : null}
          <div className="session-card-actions">
            {isStrength ? (
              <Button onClick={() => setMode("checkin")}>Inizia <ArrowRight /></Button>
            ) : null}
            {isRun ? (
              <Button onClick={() => setMode("run")}><Footprints /> Registra corsa <ArrowRight /></Button>
            ) : null}
            {isStrength ? (
              <Button variant="ghost" onClick={() => setMode("scheda")}>Vedi scheda</Button>
            ) : null}
          </div>
        </Surface>
      ) : null}

      {isStrength ? (
        <button className="next-day-prompt next-day-prompt-soft" type="button" onClick={() => setMode("next-day")}>
          <span><strong>Risposta 24 ore</strong><small>Serve per le progressioni upper body.</small></span>
          <ArrowRight />
        </button>
      ) : null}
    </div>
  );
}
