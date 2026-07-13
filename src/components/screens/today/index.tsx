"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, Clock3, Footprints, Lightbulb, Sparkles } from "lucide-react";
import { adjustForReadiness } from "@/lib/autoregulation";
import { db, getActiveBlockWeek, getResolvedTemplates, getTodayRunPlan } from "@/lib/db";
import { getExerciseById } from "@/lib/exercise-library";
import { EXERCISES, getCycleTargets, TEMPLATES } from "@/lib/program";
import { getTemplateForDayWithOverrides } from "@/lib/training-engine";
import type { DailyReadiness, ExercisePrescription, WorkoutTemplate } from "@/lib/types";
import { canManagePlans } from "@/lib/roles";
import { useAppStore } from "@/lib/store";
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
          <p>Esercizi, carichi, pause e hint del piano.</p>
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
                  <p>{exercise?.pattern}</p>
                </div>
              </div>
              <dl className="scheda-meta">
                <div><dt>Volume</dt><dd>{formatVolume(prescription)}{exercise?.unilateral ? " / lato" : ""}</dd></div>
                <div><dt>RIR</dt><dd>{prescription.targetRir.join("–")}</dd></div>
                <div><dt>Carico</dt><dd>{prescription.targetLoadKg != null ? `${prescription.targetLoadKg} kg / manubrio` : prescription.variant !== "standard" ? prescription.variant : "da registrare"}</dd></div>
                <div><dt>Pausa</dt><dd>{prescription.restSeconds ?? 90} s</dd></div>
                <div><dt>Tempo</dt><dd>{prescription.tempo}</dd></div>
                <div><dt>ROM</dt><dd>{prescription.rangeOfMotion}</dd></div>
              </dl>
              {prescription.hint ? (
                <p className="scheda-hint"><Lightbulb size={16} aria-hidden="true" /> {prescription.hint}</p>
              ) : null}
              {exercise?.safetyNotes?.length ? (
                <p className="scheda-safety">{exercise.safetyNotes.join(" · ")}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
      {template.notes?.length ? (
        <Surface>
          <p className="date-label">Note scheda</p>
          {template.notes.map((note) => <p key={note}>{note}</p>)}
        </Surface>
      ) : null}
      <Button onClick={onStart}>Inizia check-in <ArrowRight /></Button>
    </div>
  );
}

export function TodayScreen() {
  const profile = useLiveQuery(() => db.profiles.toCollection().first());
  const account = useLiveQuery(() => db.accountProfiles.toCollection().first());
  const activePrescriptions = useLiveQuery(() => db.activePrescriptions.toArray(), [], []) ?? [];
  const resolvedTemplates = useLiveQuery(() => getResolvedTemplates(), [], TEMPLATES) ?? TEMPLATES;
  const latestDecision = useLiveQuery(() => db.progressionDecisions.orderBy("date").last());
  const latestRunCalibration = useLiveQuery(() => db.runCalibrationDecisions.orderBy("date").last());
  const runPlan = useLiveQuery(() => getTodayRunPlan(today), [isoToday]);
  const blockWeek = useLiveQuery(() => getActiveBlockWeek(), [], 4);
  const [mode, setMode] = useState<Mode>("overview");
  const [readiness, setReadiness] = useState(makeReadiness);
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);

  const template = useMemo(
    () => getTemplateForDayWithOverrides(today.getDay(), activePrescriptions, resolvedTemplates),
    [activePrescriptions, resolvedTemplates],
  );
  const adjustment = adjustForReadiness(readiness);
  const targets = getCycleTargets(blockWeek);
  const { setTab } = useAppStore();
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
      />
    );
  }
  if (mode === "done") return <CompletionPanel onHome={() => setMode("overview")} />;
  if (mode === "next-day") return <NextDayPanel onBack={() => setMode("overview")} />;

  const firstPrescription = template.prescriptions[0];
  const firstExercise = getExerciseById(firstPrescription?.exerciseId ?? "") ?? EXERCISES.find((exercise) => exercise.id === firstPrescription?.exerciseId);
  const isStrength = template.kind === "strength";
  const isRun = template.kind === "run";

  return (
    <div className="today-screen">
      {isClient ? (
        <p className="welcome-banner" role="status">{welcome}</p>
      ) : null}

      <section className="today-hero">
        <p className="date-label">{dateLabel}</p>
        <h1>{template.name}</h1>
        <span className="hero-rule" />
        {template.estimatedMinutes ? (
          <p className="duration"><Clock3 aria-hidden="true" /> {runPlan?.durationMinutes ?? template.estimatedMinutes} min</p>
        ) : null}
      </section>

      {template.kind === "free" ? (
        <Surface className="free-day"><h2>Domenica libera</h2><p>Nessuna seduta, recupero o notifica da completare.</p></Surface>
      ) : null}

      <button className="change-rail" type="button" onClick={() => setTab("progress")}>
        <span><Sparkles /></span>
        <strong>{latestRunCalibration?.reason ?? latestDecision?.reason ?? "Piano iniziale: volume prudente e regole visibili."}</strong>
        <ArrowRight />
      </button>

      {isRun && runPlan ? (
        <Surface className="run-plan-preview">
          <p className="date-label">Piano corsa {runPlan.status === "calibrated" ? "calibrato" : "previsto"}</p>
          <h2>{runPlan.durationMinutes} min · {runPlan.type === "controlled-quality" ? "qualità controllata" : "facile"}</h2>
          {runPlan.notes?.map((note) => <p key={note}>{note}</p>)}
        </Surface>
      ) : null}

      <section className="readiness-preview">
        <h2>Come stai oggi?</h2>
        <div>
          <button type="button" onClick={() => setMode("checkin")}><span>Energia</span><strong>{readiness.energy}</strong></button>
          <button type="button" onClick={() => setMode("checkin")}><span>Sonno</span><strong>{readiness.sleep}</strong></button>
          <button type="button" onClick={() => setMode("checkin")}><span>Gambe</span><strong>{readiness.legSoreness}</strong></button>
        </div>
        <p>Valuta prima di applicare qualsiasi adattamento.</p>
      </section>

      {firstExercise ? (
        <section className="next-exercise">
          <p>Primo esercizio</p>
          <h2>{firstExercise.name}</h2>
          <span>
            {targets.setCap ?? firstPrescription.sets} × {firstPrescription.repRange?.join("–")}{" "}
            {firstExercise.unilateral ? "per lato" : ""} · RIR {targets.targetRir.join("–")}
            {firstPrescription.restSeconds ? ` · pausa ${firstPrescription.restSeconds}s` : ""}
          </span>
        </section>
      ) : null}

      <div className="primary-actions">
        {isStrength ? <Button onClick={() => setMode("checkin")}>Inizia check-in <ArrowRight /></Button> : null}
        {isStrength ? <Button variant="secondary" onClick={() => setMode("scheda")}>Vedi scheda completa <ArrowRight /></Button> : null}
        {isRun ? <Button onClick={() => setMode("run")}><Footprints /> Registra la corsa <ArrowRight /></Button> : null}
        {template.kind === "recovery" ? (
          <p className="recovery-copy">Riposo, passeggiata libera o mobilità non provocativa. Nessun obbligo e nessuna penalità.</p>
        ) : null}
        {template.kind !== "free" ? (
          <Button variant="secondary" onClick={() => setTab("calendar")}>Vedi calendario <ArrowRight /></Button>
        ) : null}
      </div>

      <button className="next-day-prompt" type="button" onClick={() => setMode("next-day")}>
        <span><strong>Risposta nelle 24 ore</strong><small>Necessaria prima di progredire nell’upper body.</small></span>
        <ArrowRight />
      </button>
    </div>
  );
}
