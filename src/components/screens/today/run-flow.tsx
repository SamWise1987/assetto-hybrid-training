"use client";

import { useState } from "react";
import { z } from "zod";
import { Activity, Heart, MapPin } from "lucide-react";
import { completeRunSession } from "@/lib/db";
import type { RunPlan, RunSession } from "@/lib/types";
import { Button, Field, ScaleControl, Surface } from "../../ui";
import { ScreenHeader } from "./shared-panels";

const runSchema = z.object({
  duration: z.coerce.number().min(5).max(240),
  distance: z.coerce.number().min(0).max(100),
  rpe: z.coerce.number().int().min(1).max(10),
  avgHr: z.coerce.number().int().min(0).max(220).optional(),
  maxHr: z.coerce.number().int().min(0).max(220).optional(),
});

const runTypeLabels: Record<RunSession["type"], string> = {
  easy: "Facile",
  "long-easy": "Lunga facile",
  "controlled-quality": "Qualità controllata",
  walk: "Passeggiata",
};

export function RunFlow({
  plan,
  onBack,
  onComplete,
}: {
  plan?: RunPlan;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [form, setForm] = useState({
    type: (plan?.type ?? "easy") as RunSession["type"],
    duration: plan?.durationMinutes ?? 40,
    distance: 5.5,
    rpe: 4,
    avgHr: 0,
    maxHr: 0,
    talkTest: "full-sentences" as RunSession["talkTest"],
    symptoms: 0,
  });
  const [error, setError] = useState("");
  const [calibrationMessage, setCalibrationMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const result = runSchema.safeParse({
      ...form,
      avgHr: form.avgHr || undefined,
      maxHr: form.maxHr || undefined,
    });
    if (!result.success) {
      setError("Controlla durata, distanza e RPE.");
      return;
    }

    setBusy(true);
    const date = new Date().toISOString().slice(0, 10);
    const run: RunSession = {
      id: crypto.randomUUID(),
      date,
      type: form.type,
      status: form.symptoms > 3 ? "stopped" : "complete",
      durationMinutes: result.data.duration,
      distanceKm: result.data.distance,
      averagePace: result.data.distance
        ? `${Math.floor(result.data.duration / result.data.distance)}:${String(
            Math.round(((result.data.duration / result.data.distance) % 1) * 60),
          ).padStart(2, "0")}`
        : undefined,
      rpe: result.data.rpe,
      averageHeartRate: result.data.avgHr || undefined,
      maxHeartRate: result.data.maxHr || undefined,
      talkTest: form.talkTest,
      symptomsDuring: form.symptoms,
      source: "manual",
    };

    const calibration = await completeRunSession(run);
    if (calibration) {
      setCalibrationMessage(calibration.reason);
      setTimeout(onComplete, 1800);
      return;
    }

    setBusy(false);
    onComplete();
  };

  return (
    <div className="flow-screen">
      <ScreenHeader
        title="Registra corsa"
        caption={plan ? `Previsto: ${plan.durationMinutes} min · ${runTypeLabels[plan.type]}` : "Inserisci quanto hai corso oggi."}
        onBack={onBack}
      />

      {plan ? (
        <Surface className="run-target-card">
          <div className="surface-heading">
            <div><p className="date-label">Obiettivo di oggi</p><h2>{plan.durationMinutes} min</h2></div>
            <Activity />
          </div>
          <p>{runTypeLabels[plan.type]} · RPE target 3–4 · talk test: frasi complete</p>
          {plan.notes?.map((note) => <p key={note}>{note}</p>)}
        </Surface>
      ) : null}

      <Surface className="run-form">
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
          <Field
            label="Durata (min)"
            type="number"
            inputMode="numeric"
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
          />
          <Field
            label="Distanza (km)"
            type="number"
            inputMode="decimal"
            step="0.1"
            value={form.distance}
            onChange={(e) => setForm({ ...form, distance: Number(e.target.value) })}
          />
        </div>
        <div className="two-column">
          <Field
            label="FC media (opz.)"
            type="number"
            inputMode="numeric"
            value={form.avgHr || ""}
            onChange={(e) => setForm({ ...form, avgHr: Number(e.target.value) })}
          />
          <Field
            label="FC max (opz.)"
            type="number"
            inputMode="numeric"
            value={form.maxHr || ""}
            onChange={(e) => setForm({ ...form, maxHr: Number(e.target.value) })}
          />
        </div>
        <ScaleControl label="RPE" value={form.rpe} min={1} max={10} onChange={(rpe) => setForm({ ...form, rpe })} />
        <label className="field">
          <span>Talk test</span>
          <select
            value={form.talkTest}
            onChange={(e) => setForm({ ...form, talkTest: e.target.value as RunSession["talkTest"] })}
          >
            <option value="full-sentences">Frasi complete</option>
            <option value="short-phrases">Frasi brevi</option>
            <option value="failed">Non superato</option>
          </select>
        </label>
        <ScaleControl
          label="Dolore o sintomi durante"
          value={form.symptoms}
          min={0}
          max={10}
          onChange={(symptoms) => setForm({ ...form, symptoms })}
        />
        <p className="quiet-note"><MapPin /> Puoi anche importare da Strava o file GPX in Impostazioni → Integrazioni.</p>
        {form.symptoms > 3 ? (
          <p className="form-error">Interrompi. Una camminata facile è ammessa solo se asintomatica.</p>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        {calibrationMessage ? <p className="success-message" role="status">{calibrationMessage}</p> : null}
        <Button onClick={save} disabled={busy}>
          <Heart /> {busy ? "Calibro il sabato…" : "Salva corsa"}
        </Button>
      </Surface>
    </div>
  );
}
