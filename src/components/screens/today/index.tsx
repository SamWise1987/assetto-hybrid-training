"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, Clock3, Footprints, Sparkles } from "lucide-react";
import { adjustForReadiness } from "@/lib/autoregulation";
import { db, getActiveBlockWeek, getTodayRunPlan } from "@/lib/db";
import { EXERCISES, getCycleTargets } from "@/lib/program";
import { getTemplateForDayWithOverrides } from "@/lib/training-engine";
import type { DailyReadiness } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { Button, Surface } from "../../ui";
import { RunFlow } from "./run-flow";
import { WorkoutFlow } from "./workout-flow";
import { NextDayPanel, CompletionPanel } from "./shared-panels";

type Mode = "overview" | "checkin" | "stop" | "warmup" | "workout" | "checkout" | "done" | "next-day" | "run";

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

export function TodayScreen() {
  const activePrescriptions = useLiveQuery(() => db.activePrescriptions.toArray(), [], []);
  const latestDecision = useLiveQuery(() => db.progressionDecisions.orderBy("date").last());
  const latestRunCalibration = useLiveQuery(() => db.runCalibrationDecisions.orderBy("date").last());
  const runPlan = useLiveQuery(() => getTodayRunPlan(today), [isoToday]);
  const blockWeek = useLiveQuery(() => getActiveBlockWeek(), [], 4);
  const [mode, setMode] = useState<Mode>("overview");
  const [readiness, setReadiness] = useState(makeReadiness);
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);

  const template = useMemo(
    () => getTemplateForDayWithOverrides(today.getDay(), activePrescriptions),
    [activePrescriptions],
  );
  const adjustment = adjustForReadiness(readiness);
  const targets = getCycleTargets(blockWeek);
  const { setTab } = useAppStore();

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
  const firstExercise = EXERCISES.find((exercise) => exercise.id === firstPrescription?.exerciseId);
  const isStrength = template.kind === "strength";
  const isRun = template.kind === "run";

  return (
    <div className="today-screen">
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
          </span>
        </section>
      ) : null}

      <div className="primary-actions">
        {isStrength ? <Button onClick={() => setMode("checkin")}>Inizia check-in <ArrowRight /></Button> : null}
        {isRun ? <Button onClick={() => setMode("run")}><Footprints /> Registra la corsa <ArrowRight /></Button> : null}
        {template.kind === "recovery" ? (
          <p className="recovery-copy">Riposo, passeggiata libera o mobilità non provocativa. Nessun obbligo e nessuna penalità.</p>
        ) : null}
        {template.kind !== "free" ? (
          <Button variant="secondary" onClick={() => setTab("calendar")}>Vedi piano <ArrowRight /></Button>
        ) : null}
      </div>

      <button className="next-day-prompt" type="button" onClick={() => setMode("next-day")}>
        <span><strong>Risposta nelle 24 ore</strong><small>Necessaria prima di progredire nell’upper body.</small></span>
        <ArrowRight />
      </button>
    </div>
  );
}
