"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarCheck, Check, Footprints, Info, MoveRight } from "lucide-react";
import { z } from "zod";
import { completeRunSession, db, ensureRunPlansForCurrentWeek, getActiveBlockWeek } from "@/lib/db";
import { TEMPLATES } from "@/lib/program";
import type { RunSession } from "@/lib/types";
import { Button, Field, ScaleControl, Surface } from "../ui";

const DAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const runSchema = z.object({
  duration: z.coerce.number().min(5).max(240),
  distance: z.coerce.number().min(0).max(100),
  rpe: z.coerce.number().int().min(1).max(10),
});

export function CalendarScreen() {
  const runs = useLiveQuery(() => db.runs.orderBy("date").reverse().toArray()) ?? [];
  const runPlans = useLiveQuery(() => ensureRunPlansForCurrentWeek(), []) ?? [];
  const calibrations = useLiveQuery(() => db.runCalibrationDecisions.orderBy("date").reverse().toArray()) ?? [];
  const blockWeek = useLiveQuery(() => getActiveBlockWeek(), [], 4);
  const [showRun, setShowRun] = useState(false);
  const [moveMessage, setMoveMessage] = useState("");
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((day) => TEMPLATES.find((template) => template.dayOfWeek === day)!);

  return (
    <div className="screen-stack">
      <header className="section-heading">
        <p className="date-label">Settimana {blockWeek} di 8</p>
        <h1>Calendario</h1>
        <p>La domenica resta fuori dal sistema: nessun recupero automatico.</p>
      </header>
      <div className="week-list">
        {ordered.map((template) => {
          const plan = runPlans.find((entry) => entry.dayOfWeek === template.dayOfWeek);
          return (
            <article key={template.id} className={template.kind === "free" ? "is-free" : ""}>
              <div>
                <span>{DAYS[template.dayOfWeek]}</span>
                <h2>{template.name}</h2>
                <p>
                  {plan
                    ? `${plan.durationMinutes} min · ${plan.status === "calibrated" ? "calibrato" : "previsto"}`
                    : template.estimatedMinutes
                      ? `circa ${template.estimatedMinutes} min`
                      : template.notes?.[0]}
                </p>
              </div>
              {template.kind !== "free" && template.kind !== "recovery" ? (
                <button
                  type="button"
                  onClick={() => setMoveMessage("Puoi spostare la seduta tra lunedì e sabato. La qualità non verrà messa dopo un lower body pesante.")}
                  aria-label={`Sposta ${template.name}`}
                >
                  <MoveRight />
                </button>
              ) : (
                <span className="day-status">{template.kind === "free" ? "Libera" : "Facoltativo"}</span>
              )}
            </article>
          );
        })}
      </div>
      {moveMessage ? <p className="info-message"><Info /> {moveMessage}</p> : null}
      {calibrations[0] ? (
        <Surface>
          <p className="date-label">Calibrazione corsa</p>
          <h2>{calibrations[0].reason}</h2>
          <p>Sabato: {calibrations[0].outputPlan.durationMinutes} min · {calibrations[0].outputPlan.type}</p>
        </Surface>
      ) : null}
      <Button onClick={() => setShowRun(!showRun)}><Footprints /> {showRun ? "Chiudi registrazione" : "Registra una corsa"}</Button>
      {showRun ? <RunForm onSaved={() => setShowRun(false)} /> : null}
      <Surface>
        <div className="surface-heading">
          <div><p className="date-label">Storico corsa</p><h2>Ultime uscite</h2></div>
          <CalendarCheck />
        </div>
        <div className="history-list">
          {runs.slice(0, 5).map((run) => (
            <article key={run.id}>
              <div>
                <strong>{run.type === "controlled-quality" ? "Qualità controllata" : "Facile"}</strong>
                <span>{new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(new Date(`${run.date}T12:00:00`))}</span>
              </div>
              <p>{run.durationMinutes} min · {run.distanceKm ?? "—"} km · RPE {run.rpe}</p>
              {run.conversionReason ? <small>{run.conversionReason}</small> : null}
            </article>
          ))}
        </div>
      </Surface>
    </div>
  );
}

function RunForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({
    type: "easy" as RunSession["type"],
    duration: 40,
    distance: 5.5,
    rpe: 4,
    talkTest: "full-sentences" as RunSession["talkTest"],
    symptoms: 0,
  });
  const [error, setError] = useState("");
  const [calibrationMessage, setCalibrationMessage] = useState("");

  const save = async () => {
    const result = runSchema.safeParse(form);
    if (!result.success) {
      setError("Controlla durata, distanza e RPE.");
      return;
    }
    const run: RunSession = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      type: form.type,
      status: form.symptoms > 3 ? "stopped" : "complete",
      durationMinutes: result.data.duration,
      distanceKm: result.data.distance,
      averagePace: result.data.distance
        ? `${Math.floor(result.data.duration / result.data.distance)}:${String(Math.round(((result.data.duration / result.data.distance) % 1) * 60)).padStart(2, "0")}`
        : undefined,
      rpe: result.data.rpe,
      talkTest: form.talkTest,
      symptomsDuring: form.symptoms,
    };
    const calibration = await completeRunSession(run);
    if (calibration) setCalibrationMessage(calibration.reason);
    onSaved();
  };

  return (
    <Surface className="run-form">
      <h2>Nuova corsa</h2>
      <label className="field">
        <span>Tipo</span>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as RunSession["type"] })}>
          <option value="easy">Facile</option>
          <option value="long-easy">Lunga facile</option>
          <option value="controlled-quality">Qualità controllata</option>
          <option value="walk">Passeggiata</option>
        </select>
      </label>
      <div className="two-column">
        <Field label="Durata (min)" type="number" inputMode="numeric" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} />
        <Field label="Distanza (km)" type="number" inputMode="decimal" step="0.1" value={form.distance} onChange={(e) => setForm({ ...form, distance: Number(e.target.value) })} />
      </div>
      <ScaleControl label="RPE" value={form.rpe} min={1} max={10} onChange={(rpe) => setForm({ ...form, rpe })} />
      <label className="field">
        <span>Talk test</span>
        <select value={form.talkTest} onChange={(e) => setForm({ ...form, talkTest: e.target.value as RunSession["talkTest"] })}>
          <option value="full-sentences">Frasi complete</option>
          <option value="short-phrases">Frasi brevi</option>
          <option value="failed">Non superato</option>
        </select>
      </label>
      <ScaleControl label="Dolore o sintomi durante" value={form.symptoms} min={0} max={10} onChange={(symptoms) => setForm({ ...form, symptoms })} />
      {form.symptoms > 3 ? <p className="form-error">Interrompi. Una camminata facile è ammessa solo se asintomatica.</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {calibrationMessage ? <p className="success-message">{calibrationMessage}</p> : null}
      <Button onClick={save}>Salva corsa <Check /></Button>
    </Surface>
  );
}
