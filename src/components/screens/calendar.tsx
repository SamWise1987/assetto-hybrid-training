"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { it } from "date-fns/locale";
import { Bell, CalendarCheck, Check, ChevronLeft, ChevronRight, Footprints, Info } from "lucide-react";
import { completeRunSession, db, ensureRunPlansForCurrentWeek, getActiveBlockWeek, getResolvedTemplates } from "@/lib/db";
import type { RunSession, WorkoutTemplate } from "@/lib/types";
import { z } from "zod";
import { Button, Field, ScaleControl, Surface } from "../ui";
import { currentPlatform } from "@/lib/platform";
import { isScheduledTemplateComplete, matchedExternalForTemplateDate, strengthSessionForTemplateDate } from "@/lib/calendar-activity";
import { handleRovingTabKey } from "@/lib/keyboard-navigation";

const DAYS_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const DAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const CALENDAR_VIEWS = ["month", "week"] as const;
const runSchema = z.object({
  duration: z.coerce.number().min(5).max(240),
  distance: z.coerce.number().min(0).max(100),
  rpe: z.coerce.number().int().min(1).max(10),
});

function toIsoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function templateForDate(date: Date, templates: WorkoutTemplate[]) {
  return templates.find((template) => template.dayOfWeek === date.getDay());
}

function isWorkoutDay(template?: WorkoutTemplate) {
  return Boolean(template && template.kind !== "free");
}

export function CalendarScreen() {
  const runs = useLiveQuery(() => db.runs.orderBy("date").reverse().toArray()) ?? [];
  const sessions = useLiveQuery(() => db.workoutSessions.toArray(), [], []) ?? [];
  const externalWorkouts = useLiveQuery(() => db.externalWorkouts.toArray(), [], []);
  const runPlans = useLiveQuery(() => ensureRunPlansForCurrentWeek(), []) ?? [];
  const calibrations = useLiveQuery(() => db.runCalibrationDecisions.orderBy("date").reverse().toArray()) ?? [];
  const blockWeek = useLiveQuery(() => getActiveBlockWeek(), [], 4);
  const resolvedTemplates = useLiveQuery(() => getResolvedTemplates(), [], []);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [showRun, setShowRun] = useState(false);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(selected, { weekStartsOn: 1 });
    const end = endOfWeek(selected, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [selected]);

  const gridDays = view === "month" ? monthDays : weekDays;
  const selectedTemplate = templateForDate(selected, resolvedTemplates);
  const selectedIso = toIsoDate(selected);
  const selectedRunPlan = runPlans.find((entry) => entry.date === selectedIso || entry.dayOfWeek === selected.getDay());
  const selectedSession = selectedTemplate?.kind === "strength"
    ? strengthSessionForTemplateDate(sessions, selectedIso, selectedTemplate.id)
    : undefined;
  const selectedExternal = selectedTemplate?.kind === "strength"
    ? matchedExternalForTemplateDate(externalWorkouts, selectedIso, selectedTemplate.id)
    : undefined;
  const selectedRun = selectedTemplate?.kind === "run" ? runs.find((entry) => entry.date === selectedIso) : undefined;

  const reminders = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = endOfWeek(addMonths(start, 0), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end })
      .map((day) => {
        const template = templateForDate(day, resolvedTemplates);
        if (!isWorkoutDay(template) || template?.kind === "recovery") return null;
        return {
          date: day,
          template: template!,
          reminder: template!.kind === "run"
            ? `Reminder: ${template!.name} · prepara scarpe e talk test`
            : `Reminder: ${template!.name} · check-in e scheda pronti`,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [resolvedTemplates]);

  const moveCalendarFocus = (event: React.KeyboardEvent<HTMLButtonElement>, day: Date) => {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const currentIndex = gridDays.findIndex((entry) => isSameDay(entry, day));
    const weekStartIndex = Math.floor(currentIndex / 7) * 7;
    const nextIndex = event.key === "Home"
      ? weekStartIndex
      : event.key === "End"
        ? weekStartIndex + 6
        : currentIndex + (offsets[event.key] ?? 0);
    if (!(event.key in offsets) && event.key !== "Home" && event.key !== "End") return;
    if (nextIndex < 0 || nextIndex >= gridDays.length) return;
    event.preventDefault();
    const nextDay = gridDays[nextIndex];
    setSelected(nextDay);
    const nextIso = toIsoDate(nextDay);
    event.currentTarget.closest('[role="grid"]')?.querySelector<HTMLElement>(`[data-calendar-date="${nextIso}"]`)?.focus();
  };

  return (
    <div className="screen-stack">
      <header className="section-heading">
        <p className="date-label">Settimana {blockWeek} di 8</p>
        <h1>Calendario</h1>
        <p>Giorni, settimane e mesi con i tuoi allenamenti e i reminder delle sedute.</p>
      </header>

      <div className="calendar-toolbar">
        <div className="calendar-view-toggle" role="tablist" aria-label="Vista calendario">
          {CALENDAR_VIEWS.map((option) => <button
            key={option}
            id={`calendar-view-${option}`}
            type="button"
            role="tab"
            aria-selected={view === option}
            aria-controls="calendar-view-panel"
            tabIndex={view === option ? 0 : -1}
            className={view === option ? "is-active" : ""}
            onClick={() => setView(option)}
            onKeyDown={(event) => handleRovingTabKey(event, CALENDAR_VIEWS, view, setView)}
          >{option === "month" ? "Mese" : "Settimana"}</button>)}
        </div>
        <div className="calendar-nav">
          <button
            type="button"
            aria-label="Periodo precedente"
            onClick={() => {
              if (view === "month") setCursor((value) => subMonths(value, 1));
              else setSelected((value) => new Date(value.getFullYear(), value.getMonth(), value.getDate() - 7));
            }}
          >
            <ChevronLeft />
          </button>
          <strong>
            {view === "month"
              ? format(cursor, "MMMM yyyy", { locale: it })
              : `${format(weekDays[0], "d MMM", { locale: it })} – ${format(weekDays[6], "d MMM yyyy", { locale: it })}`}
          </strong>
          <button
            type="button"
            aria-label="Periodo successivo"
            onClick={() => {
              if (view === "month") setCursor((value) => addMonths(value, 1));
              else setSelected((value) => new Date(value.getFullYear(), value.getMonth(), value.getDate() + 7));
            }}
          >
            <ChevronRight />
          </button>
        </div>
      </div>

      <div id="calendar-view-panel" role="tabpanel" aria-labelledby={`calendar-view-${view}`}>
        <div className="calendar-grid" role="grid" aria-label={view === "month" ? "Calendario mensile" : "Calendario settimanale"}>
          <div role="row" className="calendar-grid-row">
            {DAYS_SHORT.map((label) => (
              <div key={label} className="calendar-weekday" role="columnheader">{label}</div>
            ))}
          </div>
          {Array.from({ length: Math.ceil(gridDays.length / 7) }, (_, rowIndex) => (
            <div key={rowIndex} role="row" className="calendar-grid-row">
              {gridDays.slice(rowIndex * 7, rowIndex * 7 + 7).map((day) => {
                const template = templateForDate(day, resolvedTemplates);
                const workout = isWorkoutDay(template);
                const iso = toIsoDate(day);
                const done = isScheduledTemplateComplete({ date: iso, template, sessions, runs, externalWorkouts });
                return (
                  <button
                    key={iso}
                    type="button"
                    role="gridcell"
                    data-calendar-date={iso}
                    tabIndex={isSameDay(day, selected) ? 0 : -1}
                    className={[
                      "calendar-day",
                      !isSameMonth(day, cursor) && view === "month" ? "is-outside" : "",
                      isToday(day) ? "is-today" : "",
                      isSameDay(day, selected) ? "is-selected" : "",
                      workout ? "has-workout" : "",
                      template?.kind === "run" ? "is-run" : "",
                      template?.kind === "recovery" ? "is-recovery" : "",
                      done ? "is-done" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => {
                      setSelected(day);
                      if (view === "month") setCursor(startOfMonth(day));
                    }}
                    onKeyDown={(event) => moveCalendarFocus(event, day)}
                    aria-label={`${format(day, "EEEE d MMMM", { locale: it })}${template ? `, ${template.name}` : ""}${done ? ", completato" : ""}`}
                    aria-selected={isSameDay(day, selected)}
                    aria-current={isToday(day) ? "date" : undefined}
                  >
                    <span className="calendar-day-number">{format(day, "d")}</span>
                    {workout ? <span className="calendar-day-dot" aria-hidden="true" /> : null}
                    {workout && template ? <span className="calendar-day-label">{template.name}</span> : null}
                    {workout && template?.kind !== "recovery" ? <Bell className="calendar-day-bell" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <Surface className="calendar-day-detail">
        <div className="surface-heading">
          <div>
            <p className="date-label">{format(selected, "EEEE d MMMM", { locale: it })}</p>
            <h2>{selectedTemplate?.name ?? "Nessuna seduta"}</h2>
          </div>
          {selectedTemplate && selectedTemplate.kind !== "free" && selectedTemplate.kind !== "recovery" ? (
            <span className="reminder-pill"><Bell size={14} /> Reminder attivo</span>
          ) : null}
        </div>
        {selectedTemplate?.kind === "free" ? (
          <p>Domenica libera: nessun recupero automatico e nessun reminder.</p>
        ) : null}
        {selectedTemplate?.kind === "recovery" ? (
          <p>{selectedTemplate.notes?.[0] ?? "Recupero facoltativo."}</p>
        ) : null}
        {selectedTemplate?.kind === "strength" ? (
          <div className="calendar-detail-meta">
            <p>Circa {selectedTemplate.estimatedMinutes} min · {selectedTemplate.prescriptions.length} esercizi in scheda</p>
            {selectedSession ? <p className="success-message">Seduta già registrata ({selectedSession.status}).</p> : selectedExternal ? <p className="success-message">Attività Health associata alla scheda. Conta per l’aderenza, senza progressioni di serie automatiche.</p> : <p>Reminder: completa check-in e registra carichi, pause e hint della scheda.</p>}
          </div>
        ) : null}
        {selectedTemplate?.kind === "run" ? (
          <div className="calendar-detail-meta">
            <p>
              {selectedRunPlan
                ? `${selectedRunPlan.durationMinutes} min · ${selectedRunPlan.status === "calibrated" ? "calibrato" : "previsto"}`
                : `circa ${selectedTemplate.estimatedMinutes} min`}
            </p>
            {selectedTemplate.notes?.map((note) => <p key={note}>{note}</p>)}
            {selectedRun ? <p className="success-message">Corsa registrata{selectedRun.subjectiveDataAvailable === false ? " · dati soggettivi non disponibili" : ` · RPE ${selectedRun.rpe}`}</p> : <p>Reminder: talk test e sintomi da segnare a fine uscita.</p>}
          </div>
        ) : null}
      </Surface>

      <Surface>
        <div className="surface-heading">
          <div><p className="date-label">Questa settimana</p><h2>Reminder allenamenti</h2></div>
          <Bell />
        </div>
        <div className="reminder-list">
          {reminders.map((entry) => (
            <article key={toIsoDate(entry.date)}>
              <div>
                <strong>{DAYS[entry.date.getDay()]}</strong>
                <span>{format(entry.date, "d MMM", { locale: it })}</span>
              </div>
              <p>{entry.reminder}</p>
            </article>
          ))}
          {!reminders.length ? <p className="quiet-note">Nessun reminder in programma questa settimana.</p> : null}
        </div>
      </Surface>

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
              <p>{run.durationMinutes} min · {run.distanceKm ?? "—"} km · {run.subjectiveDataAvailable === false ? "RPE non disponibile" : `RPE ${run.rpe}`}</p>
              {run.conversionReason ? <small>{run.conversionReason}</small> : null}
            </article>
          ))}
        </div>
      </Surface>

      <p className="info-message"><Info /> Puoi spostare le sedute tra lunedì e sabato: evita qualità di corsa dopo un lower body pesante.</p>
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
      source: "manual",
      platform: currentPlatform(),
      subjectiveDataAvailable: true,
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
