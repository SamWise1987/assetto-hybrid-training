"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Activity, RotateCcw, TrendingUp } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { undoProgressionDecision } from "@/lib/autoregulation";
import { db, getActiveBlockWeek, getResolvedTemplates, undoRunCalibration } from "@/lib/db";
import { buildProgressSummary, countRecentWeeksWithData } from "@/lib/progress-analytics";
import { Button, EmptyState, Surface } from "../ui";

export function ProgressScreen() {
  const decisions = useLiveQuery(() => db.progressionDecisions.orderBy("date").reverse().toArray()) ?? [];
  const runCalibrations = useLiveQuery(() => db.runCalibrationDecisions.orderBy("date").reverse().toArray()) ?? [];
  const coachReview = useLiveQuery(() => db.coachReviews.orderBy("date").last());
  const workouts = useLiveQuery(() => db.workoutSessions.toArray(), [], []);
  const runs = useLiveQuery(() => db.runs.toArray(), [], []);
  const readiness = useLiveQuery(() => db.readiness.toArray(), [], []);
  const matchedExternalWorkouts = useLiveQuery(() => db.externalWorkouts.filter((item) => Boolean(item.matchedTemplateId)).toArray(), [], []);
  const plannedSessionsPerWeek = useLiveQuery(async () => (
    await getResolvedTemplates()
  ).filter((item) => item.kind === "strength" || item.kind === "run").length, [], 1);
  const blockWeek = useLiveQuery(() => getActiveBlockWeek(), [], 1);

  const summary = useMemo(
    () => buildProgressSummary({ workouts, runs, readiness, blockWeek, plannedSessionsPerWeek, matchedExternalWorkouts }),
    [workouts, runs, readiness, blockWeek, plannedSessionsPerWeek, matchedExternalWorkouts],
  );
  const weeksLogged = countRecentWeeksWithData(workouts, runs);

  return (
    <div className="screen-stack">
      <header className="section-heading">
        <p className="date-label">{weeksLogged ? `${weeksLogged} settimane registrate` : "Inizia a registrare"}</p>
        <h1>Progressi</h1>
        <p>Prestazione, recupero e sintomi letti insieme. Ogni calibrazione è spiegata e annullabile.</p>
      </header>

      <div className="metric-strip">
        <div><strong>{summary.adherencePercent}%</strong><span>Aderenza blocco corrente</span></div>
        <div><strong>{summary.averageRir || "—"}</strong><span>RIR medio ultima settimana</span></div>
        <div><strong>{summary.latestWeekDistanceKm ? `${summary.latestWeekDistanceKm} km` : "—"}</strong><span>Corsa questa settimana</span></div>
      </div>

      {coachReview ? (
        <Surface>
          <p className="date-label">Revisione locale</p>
          <h2>{coachReview.summary}</h2>
          {coachReview.runNotes.map((note) => <p key={note}>{note}</p>)}
        </Surface>
      ) : null}

      <ChartSurface title="Volume per pattern" icon={<TrendingUp />} description={summary.volumeByPattern.length ? summary.volumeByPattern.map((item) => `${item.pattern}: ${item.sets} serie`).join("; ") : "Nessun volume registrato."}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={summary.volumeByPattern}>
            <CartesianGrid vertical={false} stroke="#263a47" />
            <XAxis dataKey="pattern" tick={{ fill: "#9daab1", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: "#102330", border: "1px solid #38505e" }} />
            <Bar dataKey="sets" fill="#91bd7d" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartSurface>

      <ChartSurface title="Corsa facile e qualità" icon={<Activity />} description={summary.runWeekly.length ? `Andamento su ${summary.runWeekly.length} settimane, distinto tra corsa facile e qualità.` : "Nessuna corsa registrata."}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={summary.runWeekly}>
            <CartesianGrid vertical={false} stroke="#263a47" />
            <XAxis dataKey="week" tick={{ fill: "#9daab1" }} axisLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: "#102330", border: "1px solid #38505e" }} />
            <Area type="monotone" dataKey="easy" stackId="1" stroke="#91bd7d" fill="#91bd7d" />
            <Area type="monotone" dataKey="quality" stackId="1" stroke="#d98235" fill="#d98235" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartSurface>

      <ChartSurface title="Energia, dolore e RIR" icon={<Activity />} description={summary.recoveryWeekly.length ? `Andamento di energia, RIR e sintomi su ${summary.recoveryWeekly.length} settimane.` : "Nessun dato di recupero registrato."}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={summary.recoveryWeekly}>
            <CartesianGrid vertical={false} stroke="#263a47" />
            <XAxis dataKey="week" tick={{ fill: "#9daab1" }} axisLine={false} />
            <YAxis domain={[0, 5]} hide />
            <Tooltip contentStyle={{ background: "#102330", border: "1px solid #38505e" }} />
            <Line dataKey="energy" stroke="#91bd7d" strokeWidth={3} />
            <Line dataKey="rir" stroke="#f4eee3" strokeWidth={2} />
            <Line dataKey="shoulder" stroke="#d98235" strokeWidth={2} />
            <Line dataKey="cervical" stroke="#6fb8b7" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartSurface>

      <Surface>
        <div className="surface-heading">
          <div><p className="date-label">Calibrazioni corsa</p><h2>Martedì → sabato</h2></div>
          <Activity />
        </div>
        {runCalibrations.length ? (
          <div className="decision-list">
            {runCalibrations.map((decision) => (
              <article key={decision.id} className={decision.undoneAt ? "is-undone" : ""}>
                <h3>{decision.reason}</h3>
                <p>Regola: {decision.rule}</p>
                <p>Sabato: {decision.outputPlan.durationMinutes} min · {decision.outputPlan.type}</p>
                {decision.undoneAt ? (
                  <small>Annullata</small>
                ) : (
                  <Button variant="ghost" onClick={() => undoRunCalibration(decision.id)}>
                    Annulla calibrazione
                  </Button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Nessuna calibrazione corsa" text="Registra una corsa di martedì per calibrare il sabato." />
        )}
      </Surface>

      <Surface>
        <div className="surface-heading">
          <div><p className="date-label">Registro trasparente</p><h2>Modifiche automatiche forza</h2></div>
          <RotateCcw />
        </div>
        {decisions.length ? (
          <div className="decision-list">
            {decisions.map((decision) => (
              <article key={decision.id} className={decision.undoneAt ? "is-undone" : ""}>
                <span className={`decision-action action-${decision.action}`}>{decision.action}</span>
                <h3>{decision.reason}</h3>
                <p>Regola: {decision.rule}</p>
                {decision.undoneAt ? (
                  <small>Annullata</small>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      const undone = undoProgressionDecision(decision);
                      await db.progressionDecisions.put(undone.decision);
                    }}
                  >
                    Annulla modifica
                  </Button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Nessuna modifica" text="Le decisioni appariranno dopo le prime esposizioni complete." />
        )}
      </Surface>
    </div>
  );
}

function ChartSurface({ title, icon, description, children }: { title: string; icon: React.ReactNode; description: string; children: React.ReactNode }) {
  return (
    <Surface className="chart-surface">
      <div className="surface-heading"><h2>{title}</h2>{icon}</div>
      <div role="img" aria-label={description}>{children}</div>
      <p className="supporting-copy">{description}</p>
    </Surface>
  );
}
