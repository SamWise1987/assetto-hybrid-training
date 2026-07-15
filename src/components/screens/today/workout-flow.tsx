"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, ArrowRight, Check, Info, Lightbulb, RotateCcw, ShieldAlert, TimerReset, Undo2 } from "lucide-react";
import type { CSSProperties } from "react";
import { z } from "zod";
import type { DailyAdjustment } from "@/lib/autoregulation";
import { completeWorkoutSession, db, enqueueSync } from "@/lib/db";
import { getExerciseById } from "@/lib/exercise-library";
import { EXERCISES } from "@/lib/program";
import type { DailyReadiness, SetLog, WorkoutSession, WorkoutTemplate } from "@/lib/types";
import { Button, Field, ScaleControl, Toggle } from "../../ui";
import { adjustForReadiness } from "@/lib/autoregulation";
import { formatPreciseDuration } from "@/lib/duration";
import { currentPlatform } from "@/lib/platform";

const isoToday = new Date().toISOString().slice(0, 10);

const setSchema = z.object({
  weight: z.coerce.number().min(0).max(100),
  dumbbells: z.coerce.number().int().min(0).max(2),
  reps: z.coerce.number().int().min(1).max(100),
  rir: z.coerce.number().int().min(0).max(5),
  shoulderPain: z.coerce.number().int().min(0).max(10),
  cervicalPain: z.coerce.number().int().min(0).max(10),
});

type FlowMode = "checkin" | "stop" | "warmup" | "workout" | "checkout";

export function WorkoutFlow({
  mode,
  setMode,
  template,
  readiness,
  setReadiness,
  adjustment,
  sessionStartedAt,
  onSessionStart,
}: {
  mode: FlowMode;
  setMode: (mode: FlowMode | "overview" | "done") => void;
  template: WorkoutTemplate;
  readiness: DailyReadiness;
  setReadiness: (value: DailyReadiness) => void;
  adjustment: DailyAdjustment;
  sessionStartedAt: string | null;
  onSessionStart: () => void;
}) {
  if (mode === "checkin") {
    return (
      <CheckIn
        readiness={readiness}
        setReadiness={setReadiness}
        onBack={() => setMode("overview")}
        onContinue={async () => {
          await db.readiness.put(readiness);
          await enqueueSync({ entity: "readiness", entityId: readiness.id, operation: "upsert", payload: readiness as unknown as Record<string, unknown> });
          if (!sessionStartedAt) onSessionStart();
          setMode(adjustment.hardStopUpperBody ? "stop" : "warmup");
        }}
      />
    );
  }
  if (mode === "stop") return <SafetyStop onClose={() => setMode("done")} />;
  if (mode === "warmup") {
    return (
      <Warmup
        onBack={() => setMode("checkin")}
        onContinue={() => {
          if (!sessionStartedAt) onSessionStart();
          setMode("workout");
        }}
      />
    );
  }
  if (mode === "workout") {
    return (
      <Workout
        template={template}
        readinessId={readiness.id}
        sessionStartedAt={sessionStartedAt ?? new Date().toISOString()}
        onStop={() => setMode("checkout")}
      />
    );
  }
  return (
    <Checkout
      templateId={template.id}
      readinessId={readiness.id}
      sessionStartedAt={sessionStartedAt}
      onComplete={() => setMode("done")}
    />
  );
}

function ScreenHeader({ title, onBack, caption }: { title: string; onBack: () => void; caption?: string }) {
  return (
    <header className="flow-header">
      <button type="button" onClick={onBack} aria-label="Indietro"><ArrowLeft /></button>
      <div><h1>{title}</h1>{caption ? <p>{caption}</p> : null}</div>
    </header>
  );
}

function CheckIn({
  readiness,
  setReadiness,
  onBack,
  onContinue,
}: {
  readiness: DailyReadiness;
  setReadiness: (value: DailyReadiness) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const update = <K extends keyof DailyReadiness>(key: K, value: DailyReadiness[K]) =>
    setReadiness({ ...readiness, [key]: value });
  const adjustment = adjustForReadiness(readiness);

  return (
    <div className="flow-screen">
      <ScreenHeader title="Check-in" caption="30 secondi. Scorri le barre per dire come stai oggi." onBack={onBack} />
      <ScaleControl label="Energia" value={readiness.energy} min={1} max={5} lowLabel="Bassa" highLabel="Alta" onChange={(value) => update("energy", value as DailyReadiness["energy"])} />
      <ScaleControl label="Sonno" value={readiness.sleep} min={1} max={5} lowLabel="Scarso" highLabel="Ottimo" onChange={(value) => update("sleep", value as DailyReadiness["sleep"])} />
      <ScaleControl label="Indolenzimento gambe" value={readiness.legSoreness} min={0} max={10} lowLabel="Nessuno" highLabel="Molto" onChange={(value) => update("legSoreness", value)} />
      <ScaleControl label="Dolore spalla destra" value={readiness.shoulderPain} min={0} max={10} lowLabel="Nessuno" highLabel="Forte" onChange={(value) => update("shoulderPain", value)} />
      <ScaleControl label="Dolore cervicale" value={readiness.cervicalPain} min={0} max={10} lowLabel="Nessuno" highLabel="Forte" onChange={(value) => update("cervicalPain", value)} />
      <div className="safety-toggles">
        <Toggle danger label="Formicolio, intorpidimento o debolezza a braccio/mano" checked={readiness.armNeurologicalSymptoms} onChange={(value) => update("armNeurologicalSymptoms", value)} />
        <Toggle danger label="Peggioramento di equilibrio o coordinazione" checked={readiness.coordinationWorsened} onChange={(value) => update("coordinationWorsened", value)} />
      </div>
      {adjustment.reasons.length ? (
        <aside className={adjustment.hardStopUpperBody ? "rule-preview danger" : "rule-preview"}>
          <strong>Adattamento previsto</strong>
          {adjustment.reasons.map((reason) => <p key={reason}>{reason}</p>)}
        </aside>
      ) : null}
      <Button onClick={onContinue}>{adjustment.hardStopUpperBody ? "Continua allo stop di sicurezza" : "Conferma e continua"}</Button>
    </div>
  );
}

function SafetyStop({ onClose }: { onClose: () => void }) {
  return (
    <div className="flow-screen safety-stop" role="alert">
      <ShieldAlert />
      <p className="date-label">Stop di sicurezza</p>
      <h1>Oggi non allenare la zona superiore.</h1>
      <p>Hai segnalato un sintomo neurologico o un peggioramento della coordinazione. Chiudi la seduta e richiedi una valutazione sanitaria.</p>
      <Button variant="danger" onClick={onClose}>Chiudi la seduta</Button>
      <Button variant="secondary" onClick={onClose}>Registra solo una passeggiata libera</Button>
    </div>
  );
}

function Warmup({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const [done, setDone] = useState<string[]>([]);
  const items = [
    "Marcia o camminata veloce · 3 min",
    "Squat a corpo libero · 10",
    "Hip hinge senza peso · 10",
    "Retrazione cervicale delicata · 6–8, solo se asintomatica",
    "Push-up scapolare alla parete · 2 × 10",
    "Rotazione esterna isometrica alla parete · 2 × 20–30 s",
  ];

  return (
    <div className="flow-screen">
      <ScreenHeader title="Riscaldamento" caption="Circa 8 minuti. Ogni elemento può essere saltato." onBack={onBack} />
      <ol className="warmup-list">
        {items.map((item, index) => (
          <li key={item}>
            <button
              type="button"
              aria-pressed={done.includes(item)}
              onClick={() => setDone(done.includes(item) ? done.filter((entry) => entry !== item) : [...done, item])}
            >
              <span>{done.includes(item) ? <Check /> : index + 1}</span>
              <strong>{item}</strong>
            </button>
          </li>
        ))}
      </ol>
      <Button onClick={onContinue}>Vai alla seduta <ArrowRight /></Button>
    </div>
  );
}

function formFromPrescription(prescription: WorkoutTemplate["prescriptions"][number]) {
  return {
    weight: prescription.targetLoadKg ?? 16,
    dumbbells: 2,
    reps: prescription.repRange?.[0] ?? 10,
    rir: prescription.targetRir[0] ?? 3,
    shoulderPain: 0,
    cervicalPain: 0,
    technique: "stable" as SetLog["technique"],
  };
}

function RestTimer({
  restLeft,
  restTarget,
  onStart,
  onSkip,
}: {
  restLeft: number | null;
  restTarget: number;
  onStart: () => void;
  onSkip: () => void;
}) {
  const active = restLeft != null && restLeft > 0;
  const pct = active ? Math.max(0, Math.min(100, (restLeft / restTarget) * 100)) : 0;
  const minutes = active ? Math.floor(restLeft / 60) : Math.floor(restTarget / 60);
  const seconds = active ? restLeft % 60 : restTarget % 60;
  const display = `${minutes}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className={`rest-timer-panel ${active ? "is-running" : ""}`} role="timer" aria-live="polite">
      <div className="rest-timer-ring" style={{ "--rest-pct": `${pct}%` } as CSSProperties}>
        <div className="rest-timer-inner">
          <strong>{display}</strong>
          <span>{active ? "Pausa in corso" : "Pausa tra serie"}</span>
        </div>
      </div>
      <div className="rest-timer-actions">
        <Button variant="secondary" onClick={onStart}>
          <TimerReset /> {active ? "Riavvia" : `Avvia ${restTarget}s`}
        </Button>
        {active ? (
          <Button variant="ghost" onClick={onSkip}>Salta pausa</Button>
        ) : null}
      </div>
    </div>
  );
}

function Workout({
  template,
  readinessId,
  sessionStartedAt,
  onStop,
}: {
  template: WorkoutTemplate;
  readinessId: string;
  sessionStartedAt: string;
  onStop: () => void;
}) {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [form, setForm] = useState(() => formFromPrescription(template.prescriptions[0]));
  const [error, setError] = useState("");
  const [restLeft, setRestLeft] = useState<number | null>(null);
  const [showRirHelp, setShowRirHelp] = useState(false);
  const [elapsedLabel, setElapsedLabel] = useState("0:00");
  const active = template.prescriptions[exerciseIndex];
  const exercise = getExerciseById(active.exerciseId) ?? EXERCISES.find((entry) => entry.id === active.exerciseId)!;
  const activeLogs = logs.filter((entry) => entry.prescriptionId === active.id);
  const restTarget = active.restSeconds ?? 90;
  const setsComplete = activeLogs.length >= active.sets;
  const currentSetNumber = Math.min(activeLogs.length + 1, active.sets);

  useEffect(() => {
    if (restLeft == null || restLeft <= 0) return;
    const timer = window.setTimeout(() => setRestLeft((value) => (value == null ? null : value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [restLeft]);

  useEffect(() => {
    const tick = () => {
      const ms = Date.now() - new Date(sessionStartedAt).getTime();
      setElapsedLabel(formatPreciseDuration(ms));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [sessionStartedAt]);

  const goToExercise = (index: number) => {
    setExerciseIndex(index);
    setForm(formFromPrescription(template.prescriptions[index]));
    setRestLeft(null);
    setError("");
  };

  const saveSet = () => {
    if (setsComplete) {
      setError(`Il coach ha prescritto ${active.sets} serie: hai già completato il volume di questo esercizio.`);
      return;
    }
    const result = setSchema.safeParse(form);
    if (!result.success) {
      setError("Controlla ripetizioni, RIR e valori di dolore.");
      return;
    }
    const log: SetLog = {
      id: crypto.randomUUID(),
      sessionId: `session-${isoToday}`,
      prescriptionId: active.id,
      setNumber: activeLogs.length + 1,
      weightPerDumbbellKg: result.data.weight,
      dumbbellCount: result.data.dumbbells,
      side: exercise.unilateral ? "left" : "bilateral",
      reps: result.data.reps,
      rir: result.data.rir as SetLog["rir"],
      shoulderPain: result.data.shoulderPain,
      cervicalSymptoms: result.data.cervicalPain,
      technique: form.technique,
      variant: active.variant,
      tempo: active.tempo,
      rangeOfMotion: active.rangeOfMotion,
      confirmedAt: new Date().toISOString(),
    };
    setLogs([...logs, log]);
    setError("");
    if (activeLogs.length + 1 < active.sets) {
      setRestLeft(restTarget);
    } else {
      setRestLeft(null);
    }
  };

  const saveDraft = async () => {
    const elapsedMs = Date.now() - new Date(sessionStartedAt).getTime();
    const session: WorkoutSession = {
      id: `session-${isoToday}`,
      templateId: template.id,
      date: isoToday,
      status: "in-progress",
      readinessId,
      setLogs: logs,
      startedAt: sessionStartedAt,
      durationMinutes: Math.max(1, Math.round(elapsedMs / 60000)),
      durationPrecise: formatPreciseDuration(elapsedMs),
      modifiedExerciseIds: [],
      skippedExerciseIds: [],
      source: "app",
      platform: currentPlatform(),
    };
    await db.workoutSessions.put(session);
  };

  return (
    <div className="flow-screen workout-screen">
      <header className="workout-header">
        <div>
          <p>{template.name} · {exerciseIndex + 1}/{template.prescriptions.length}</p>
          <h1>{exercise.name}</h1>
        </div>
        <div className="workout-header-meta">
          <span className="session-clock" aria-label={`Tempo seduta ${elapsedLabel}`}>{elapsedLabel}</span>
          <button type="button" onClick={async () => { await saveDraft(); onStop(); }}>Termina</button>
        </div>
      </header>
      <div className="prescription-band">
        <strong>
          {active.sets} × {active.secondsRange ? `${active.secondsRange.join("–")} s` : active.repRange?.join("–")}{" "}
          {exercise.unilateral ? "per lato" : ""}
        </strong>
        <span>
          RIR {active.targetRir.join("–")} · tempo {active.tempo}
          {active.targetLoadKg != null ? ` · carico ${active.targetLoadKg} kg` : active.variant !== "standard" ? ` · ${active.variant}` : ""}
          {" · "}pausa {restTarget} s
        </span>
        {active.hint ? <p className="scheda-hint"><Lightbulb size={16} aria-hidden="true" /> {active.hint}</p> : null}
        <p className="quiet-note">ROM: {active.rangeOfMotion}</p>
      </div>
      <div className="set-number">
        <span>Serie</span>
        <strong>{currentSetNumber}<small>/{active.sets}</small></strong>
      </div>
      {setsComplete ? (
        <p className="success-message" role="status">
          Volume completo: {active.sets} serie su {active.sets}. Passa all’esercizio successivo o al check-out.
        </p>
      ) : null}
      <div className="set-grid">
        <Field label="kg / manubrio" type="number" inputMode="decimal" value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} />
        <Field label="n. manubri" type="number" inputMode="numeric" value={form.dumbbells} onChange={(e) => setForm({ ...form, dumbbells: Number(e.target.value) })} />
        <Field label="ripetizioni" type="number" inputMode="numeric" value={form.reps} onChange={(e) => setForm({ ...form, reps: Number(e.target.value) })} />
        <label className="field">
          <span className="field-with-info">
            RIR 0–5
            <button type="button" className="info-chip" aria-label="Cos’è il RIR" onClick={() => setShowRirHelp(!showRirHelp)}>
              <Info size={14} />
            </button>
          </span>
          <input type="number" inputMode="numeric" value={form.rir} onChange={(e) => setForm({ ...form, rir: Number(e.target.value) })} />
        </label>
      </div>
      {showRirHelp ? (
        <aside className="acronym-help">
          <strong>RIR · Reps In Reserve</strong>
          <p>Ripetizioni che ti restano in serbatoio a fine serie senza perdere la tecnica. RIR 3 ≈ ancora 3 rip possibili.</p>
        </aside>
      ) : null}
      <ScaleControl label="Dolore spalla" value={form.shoulderPain} min={0} max={10} lowLabel="Nessuno" highLabel="Forte" onChange={(shoulderPain) => setForm({ ...form, shoulderPain })} />
      <ScaleControl label="Sintomi cervicali" value={form.cervicalPain} min={0} max={10} lowLabel="Nessuno" highLabel="Forti" onChange={(cervicalPain) => setForm({ ...form, cervicalPain })} />
      <label className="field">
        <span>Qualità tecnica</span>
        <select value={form.technique} onChange={(e) => setForm({ ...form, technique: e.target.value as SetLog["technique"] })}>
          <option value="stable">Stabile</option>
          <option value="uncertain">Incerta</option>
          <option value="stopped">Interrotta</option>
        </select>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <Button onClick={saveSet} disabled={setsComplete}>Conferma serie <Check /></Button>
      <RestTimer
        restLeft={restLeft}
        restTarget={restTarget}
        onStart={() => setRestLeft(restTarget)}
        onSkip={() => setRestLeft(null)}
      />
      <div className="set-tools">
        <button type="button" onClick={saveSet} disabled={setsComplete}><RotateCcw /> Ripeti serie</button>
        <button
          type="button"
          onClick={() => {
            setLogs(logs.slice(0, -1));
            setError("");
          }}
          disabled={!logs.length}
        >
          <Undo2 /> Undo
        </button>
        <button type="button" onClick={() => setRestLeft(restTarget)}>
          <TimerReset /> Timer
        </button>
      </div>
      {activeLogs.length ? (
        <div className="logged-sets" aria-live="polite">
          {activeLogs.map((log) => (
            <span key={log.id}>S{log.setNumber} · {log.weightPerDumbbellKg} kg × {log.reps} · RIR {log.rir}</span>
          ))}
        </div>
      ) : null}
      <div className="exercise-nav">
        <Button variant="secondary" disabled={exerciseIndex === 0} onClick={() => goToExercise(exerciseIndex - 1)}>Precedente</Button>
        {exerciseIndex < template.prescriptions.length - 1 ? (
          <Button disabled={!activeLogs.length} onClick={() => goToExercise(exerciseIndex + 1)}>Esercizio successivo</Button>
        ) : (
          <Button disabled={!logs.length} onClick={async () => { await saveDraft(); onStop(); }}>Check-out</Button>
        )}
      </div>
    </div>
  );
}

function Checkout({
  templateId,
  readinessId,
  sessionStartedAt,
  onComplete,
}: {
  templateId: string;
  readinessId: string;
  sessionStartedAt: string | null;
  onComplete: () => void;
}) {
  const draft = useLiveQuery(() => db.workoutSessions.get(`session-${isoToday}`));
  const [rpe, setRpe] = useState(7);
  const [shoulder, setShoulder] = useState(0);
  const [cervical, setCervical] = useState(0);
  const [feeling, setFeeling] = useState<WorkoutSession["generalFeeling"]>("same");
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const startedAt = sessionStartedAt ?? draft?.startedAt ?? null;

  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const elapsedMs = startedAt
    ? nowMs - new Date(startedAt).getTime()
    : (draft?.durationMinutes ?? 0) * 60000;
  const preciseDuration = draft?.durationPrecise && !startedAt
    ? draft.durationPrecise
    : formatPreciseDuration(Math.max(0, elapsedMs));
  const durationMinutes = Math.max(1, Math.round(Math.max(0, elapsedMs) / 60000));

  const complete = async () => {
    setBusy(true);
    const endedAt = new Date().toISOString();
    const finalMs = startedAt ? new Date(endedAt).getTime() - new Date(startedAt).getTime() : elapsedMs;
    const precise = formatPreciseDuration(Math.max(0, finalMs));
    const session: WorkoutSession = {
      id: `session-${isoToday}`,
      templateId,
      date: isoToday,
      status: "complete",
      readinessId,
      setLogs: draft?.setLogs ?? [],
      startedAt: startedAt ?? undefined,
      endedAt,
      sessionRpe: rpe,
      durationMinutes: Math.max(1, Math.round(Math.max(0, finalMs) / 60000)),
      durationPrecise: precise,
      shoulderPainAfter: shoulder,
      cervicalPainAfter: cervical,
      modifiedExerciseIds: [],
      skippedExerciseIds: [],
      generalFeeling: feeling,
      source: "app",
      platform: currentPlatform(),
    };
    await completeWorkoutSession(session);
    setBusy(false);
    onComplete();
  };

  return (
    <div className="flow-screen">
      <ScreenHeader title="Check-out" caption="Chiudi la seduta: il motore calibra la prossima settimana." onBack={() => undefined} />
      <aside className="session-duration-card" aria-live="polite">
        <p className="date-label">Tempo sulla scheda</p>
        <strong>{preciseDuration}</strong>
        <span>Da inizio check-in/riscaldamento a ora · ≈ {durationMinutes} min</span>
      </aside>
      <ScaleControl label="Session RPE" value={rpe} min={1} max={10} lowLabel="Facile" highLabel="Massimo" onChange={setRpe} />
      <p className="quiet-note">RPE = quanto è stata dura la seduta nella tua percezione (1–10).</p>
      <ScaleControl label="Dolore spalla" value={shoulder} min={0} max={10} lowLabel="Nessuno" highLabel="Forte" onChange={setShoulder} />
      <ScaleControl label="Dolore cervicale" value={cervical} min={0} max={10} lowLabel="Nessuno" highLabel="Forte" onChange={setCervical} />
      <label className="field">
        <span>Percezione generale</span>
        <select value={feeling} onChange={(e) => setFeeling(e.target.value as WorkoutSession["generalFeeling"])}>
          <option value="better">Meglio</option>
          <option value="same">Uguale</option>
          <option value="worse">Peggio</option>
        </select>
      </label>
      <Button onClick={complete} disabled={busy}>{busy ? "Calibro il piano…" : "Completa seduta"}</Button>
    </div>
  );
}
