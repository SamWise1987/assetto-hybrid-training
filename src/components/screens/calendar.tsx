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
import { Bell, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { db, ensureRunPlansForCurrentWeek, getActiveBlockWeek, getResolvedTemplates } from "@/lib/db";
import type { WorkoutTemplate } from "@/lib/types";
import { Button, Surface } from "../ui";
import { isScheduledTemplateComplete, matchedExternalForTemplateDate, strengthSessionForTemplateDate } from "@/lib/calendar-activity";
import { handleRovingTabKey } from "@/lib/keyboard-navigation";

const DAYS_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const DAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const CALENDAR_VIEWS = ["month", "week"] as const;

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
  const [view, setView] = useState<"month" | "week">("week");
  const [showReminders, setShowReminders] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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
        <p>Una settimana chiara: tocca un giorno per i dettagli.</p>
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
          <div><p className="date-label">Questa settimana</p><h2>Reminder</h2></div>
          <Button variant="ghost" onClick={() => setShowReminders(!showReminders)}>{showReminders ? "Nascondi" : "Mostra"}</Button>
        </div>
        {showReminders ? (
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
        ) : (
          <p className="quiet-note">{reminders.length} sedute con reminder · apri per i dettagli</p>
        )}
      </Surface>

      {calibrations[0] ? (
        <Surface>
          <p className="date-label">Calibrazione corsa</p>
          <h2>{calibrations[0].reason}</h2>
          <p>Sabato: {calibrations[0].outputPlan.durationMinutes} min · {calibrations[0].outputPlan.type}</p>
        </Surface>
      ) : null}

      <Surface>
        <div className="surface-heading">
          <div><p className="date-label">Storico corsa</p><h2>Ultime uscite</h2></div>
          <Button variant="ghost" onClick={() => setShowHistory(!showHistory)}>{showHistory ? "Nascondi" : "Mostra"}</Button>
        </div>
        {showHistory ? (
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
            {!runs.length ? <p className="quiet-note">Nessuna corsa registrata.</p> : null}
          </div>
        ) : (
          <p className="quiet-note">Per registrare la corsa di oggi usa la tab Oggi.</p>
        )}
      </Surface>

      <p className="info-message"><Info /> Puoi spostare le sedute tra lunedì e sabato: evita qualità di corsa dopo un lower body pesante.</p>
    </div>
  );
}

