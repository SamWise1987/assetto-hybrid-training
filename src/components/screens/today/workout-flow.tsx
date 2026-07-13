"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, ArrowRight, Check, RotateCcw, ShieldAlert, TimerReset, Undo2 } from "lucide-react";
import { z } from "zod";
import type { DailyAdjustment } from "@/lib/autoregulation";
import { completeWorkoutSession, db } from "@/lib/db";
import { EXERCISES } from "@/lib/program";
import type { DailyReadiness, SetLog, WorkoutSession, WorkoutTemplate } from "@/lib/types";
import { Button, Field, ScaleControl, Toggle } from "../../ui";
import { adjustForReadiness } from "@/lib/autoregulation";

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
}: {
  mode: FlowMode;
  setMode: (mode: FlowMode | "overview" | "done") => void;
  template: WorkoutTemplate;
  readiness: DailyReadiness;
  setReadiness: (value: DailyReadiness) => void;
  adjustment: DailyAdjustment;
}) {
  if (mode === "checkin") {
    return (
      <CheckIn
        readiness={readiness}
        setReadiness={setReadiness}
        onBack={() => setMode("overview")}
        onContinue={async () => {
          await db.readiness.put(readiness);
          setMode(adjustment.hardStopUpperBody ? "stop" : "warmup");
        }}
      />
    );
  }
  if (mode === "stop") return <SafetyStop onClose={() => setMode("done")} />;
  if (mode === "warmup") {
    return <Warmup onBack={() => setMode("checkin")} onContinue={() => setMode("workout")} />;
  }
  if (mode === "workout") {
    return (
      <Workout
        template={template}
        readinessId={readiness.id}
        onStop={() => setMode("checkout")}
      />
    );
  }
  return (
    <Checkout
      templateId={template.id}
      readinessId={readiness.id}
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
      <ScreenHeader title="Check-in" caption="30 secondi. Queste risposte modificano solo la seduta di oggi." onBack={onBack} />
      <ScaleControl label="Energia" value={readiness.energy} min={1} max={5} onChange={(value) => update("energy", value as DailyReadiness["energy"])} />
      <ScaleControl label="Sonno" value={readiness.sleep} min={1} max={5} onChange={(value) => update("sleep", value as DailyReadiness["sleep"])} />
      <ScaleControl label="Indolenzimento gambe" value={readiness.legSoreness} min={0} max={10} onChange={(value) => update("legSoreness", value)} />
      <ScaleControl label="Dolore spalla destra" value={readiness.shoulderPain} min={0} max={10} onChange={(value) => update("shoulderPain", value)} />
      <ScaleControl label="Dolore cervicale" value={readiness.cervicalPain} min={0} max={10} onChange={(value) => update("cervicalPain", value)} />
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

function Workout({
  template,
  readinessId,
  onStop,
}: {
  template: WorkoutTemplate;
  readinessId: string;
  onStop: () => void;
}) {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [form, setForm] = useState({
    weight: 16,
    dumbbells: 2,
    reps: 10,
    rir: 3,
    shoulderPain: 0,
    cervicalPain: 0,
    technique: "stable" as SetLog["technique"],
  });
  const [error, setError] = useState("");
  const active = template.prescriptions[exerciseIndex];
  const exercise = EXERCISES.find((entry) => entry.id === active.exerciseId)!;
  const activeLogs = logs.filter((entry) => entry.prescriptionId === active.id);

  const saveSet = () => {
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
  };

  const saveDraft = async () => {
    const session: WorkoutSession = {
      id: `session-${isoToday}`,
      templateId: template.id,
      date: isoToday,
      status: "in-progress",
      readinessId,
      setLogs: logs,
      modifiedExerciseIds: [],
      skippedExerciseIds: [],
    };
    await db.workoutSessions.put(session);
  };

  return (
    <div className="flow-screen workout-screen">
      <header className="workout-header">
        <div><p>{template.name} · {exerciseIndex + 1}/{template.prescriptions.length}</p><h1>{exercise.name}</h1></div>
        <button type="button" onClick={async () => { await saveDraft(); onStop(); }}>Termina</button>
      </header>
      <div className="prescription-band">
        <strong>{active.sets} × {active.repRange?.join("–")} {exercise.unilateral ? "per lato" : ""}</strong>
        <span>RIR {active.targetRir.join("–")} · {active.tempo}</span>
      </div>
      <div className="set-number"><span>Serie</span><strong>{activeLogs.length + 1}</strong></div>
      <div className="set-grid">
        <Field label="kg / manubrio" type="number" inputMode="decimal" value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} />
        <Field label="n. manubri" type="number" inputMode="numeric" value={form.dumbbells} onChange={(e) => setForm({ ...form, dumbbells: Number(e.target.value) })} />
        <Field label="ripetizioni" type="number" inputMode="numeric" value={form.reps} onChange={(e) => setForm({ ...form, reps: Number(e.target.value) })} />
        <Field label="RIR 0–5" type="number" inputMode="numeric" value={form.rir} onChange={(e) => setForm({ ...form, rir: Number(e.target.value) })} />
        <Field label="dolore spalla" type="number" inputMode="numeric" value={form.shoulderPain} onChange={(e) => setForm({ ...form, shoulderPain: Number(e.target.value) })} />
        <Field label="sintomi cervicali" type="number" inputMode="numeric" value={form.cervicalPain} onChange={(e) => setForm({ ...form, cervicalPain: Number(e.target.value) })} />
      </div>
      <label className="field">
        <span>Qualità tecnica</span>
        <select value={form.technique} onChange={(e) => setForm({ ...form, technique: e.target.value as SetLog["technique"] })}>
          <option value="stable">Stabile</option>
          <option value="uncertain">Incerta</option>
          <option value="stopped">Interrotta</option>
        </select>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <Button onClick={saveSet}>Conferma serie <Check /></Button>
      <div className="set-tools">
        <button type="button" onClick={saveSet}><RotateCcw /> Ripeti serie</button>
        <button type="button" onClick={() => setLogs(logs.slice(0, -1))} disabled={!logs.length}><Undo2 /> Undo</button>
        <button type="button"><TimerReset /> Timer 90 s</button>
      </div>
      {activeLogs.length ? (
        <div className="logged-sets" aria-live="polite">
          {activeLogs.map((log) => (
            <span key={log.id}>S{log.setNumber} · {log.weightPerDumbbellKg} kg × {log.reps} · RIR {log.rir}</span>
          ))}
        </div>
      ) : null}
      <div className="exercise-nav">
        <Button variant="secondary" disabled={exerciseIndex === 0} onClick={() => setExerciseIndex(exerciseIndex - 1)}>Precedente</Button>
        {exerciseIndex < template.prescriptions.length - 1 ? (
          <Button disabled={!activeLogs.length} onClick={() => setExerciseIndex(exerciseIndex + 1)}>Esercizio successivo</Button>
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
  onComplete,
}: {
  templateId: string;
  readinessId: string;
  onComplete: () => void;
}) {
  const draft = useLiveQuery(() => db.workoutSessions.get(`session-${isoToday}`));
  const [rpe, setRpe] = useState(7);
  const [duration, setDuration] = useState(48);
  const [shoulder, setShoulder] = useState(0);
  const [cervical, setCervical] = useState(0);
  const [feeling, setFeeling] = useState<WorkoutSession["generalFeeling"]>("same");
  const [busy, setBusy] = useState(false);

  const complete = async () => {
    setBusy(true);
    const session: WorkoutSession = {
      id: `session-${isoToday}`,
      templateId,
      date: isoToday,
      status: "complete",
      readinessId,
      setLogs: draft?.setLogs ?? [],
      sessionRpe: rpe,
      durationMinutes: duration,
      shoulderPainAfter: shoulder,
      cervicalPainAfter: cervical,
      modifiedExerciseIds: [],
      skippedExerciseIds: [],
      generalFeeling: feeling,
    };
    await completeWorkoutSession(session);
    setBusy(false);
    onComplete();
  };

  return (
    <div className="flow-screen">
      <ScreenHeader title="Check-out" caption="Chiudi la seduta: il motore calibra la prossima settimana." onBack={() => undefined} />
      <ScaleControl label="Session RPE" value={rpe} min={1} max={10} onChange={setRpe} />
      <Field label="Durata (minuti)" type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
      <ScaleControl label="Dolore spalla" value={shoulder} min={0} max={10} onChange={setShoulder} />
      <ScaleControl label="Dolore cervicale" value={cervical} min={0} max={10} onChange={setCervical} />
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
