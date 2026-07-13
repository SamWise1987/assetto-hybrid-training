"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Activity, RotateCcw, TrendingUp } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { undoProgressionDecision } from "@/lib/autoregulation";
import { db } from "@/lib/db";
import { Button, EmptyState, Surface } from "../ui";

const runData = [
  { week: "S1", easy: 84, quality: 0, distance: 11.8 },
  { week: "S2", easy: 40, quality: 50, distance: 13.2 },
  { week: "S3", easy: 82, quality: 0, distance: 11.4 },
];
const recoveryData = [
  { week: "S1", energy: 4, shoulder: 1, cervical: 1, rir: 3.4 },
  { week: "S2", energy: 4, shoulder: 1, cervical: 1, rir: 2.8 },
  { week: "S3", energy: 2, shoulder: 3, cervical: 1, rir: 1.7 },
];
const volumeData = [
  { pattern: "Squat", sets: 8 },
  { pattern: "Spinta", sets: 7 },
  { pattern: "Tirata", sets: 10 },
  { pattern: "Hinge", sets: 7 },
  { pattern: "Core", sets: 9 },
];

export function ProgressScreen() {
  const decisions = useLiveQuery(() => db.progressionDecisions.orderBy("date").reverse().toArray()) ?? [];
  const runCalibrations = useLiveQuery(() => db.runCalibrationDecisions.orderBy("date").reverse().toArray()) ?? [];
  const coachReview = useLiveQuery(() => db.coachReviews.orderBy("date").last());
  const sessions = useLiveQuery(() => db.workoutSessions.where("status").equals("complete").count()) ?? 0;
  const runs = useLiveQuery(() => db.runs.where("status").equals("complete").count()) ?? 0;
  const adherence = Math.round(((sessions + runs) / 15) * 100);

  return (
    <div className="screen-stack">
      <header className="section-heading">
        <p className="date-label">Tre settimane registrate</p>
        <h1>Progressi</h1>
        <p>Prestazione, recupero e sintomi letti insieme. Ogni calibrazione è spiegata e annullabile.</p>
      </header>

      <div className="metric-strip">
        <div><strong>{adherence}%</strong><span>Aderenza, domeniche escluse</span></div>
        <div><strong>2.4</strong><span>RIR medio ultima settimana</span></div>
        <div><strong>11.4 km</strong><span>Corsa settimana 3</span></div>
      </div>

      {coachReview ? (
        <Surface>
          <p className="date-label">Revisione locale</p>
          <h2>{coachReview.summary}</h2>
          {coachReview.runNotes.map((note) => <p key={note}>{note}</p>)}
        </Surface>
      ) : null}

      <ChartSurface title="Volume per pattern" icon={<TrendingUp />}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={volumeData}>
            <CartesianGrid vertical={false} stroke="#263a47" />
            <XAxis dataKey="pattern" tick={{ fill: "#9daab1", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: "#102330", border: "1px solid #38505e" }} />
            <Bar dataKey="sets" fill="#91bd7d" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartSurface>

      <ChartSurface title="Corsa facile e qualità" icon={<Activity />}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={runData}>
            <CartesianGrid vertical={false} stroke="#263a47" />
            <XAxis dataKey="week" tick={{ fill: "#9daab1" }} axisLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: "#102330", border: "1px solid #38505e" }} />
            <Area type="monotone" dataKey="easy" stackId="1" stroke="#91bd7d" fill="#91bd7d" />
            <Area type="monotone" dataKey="quality" stackId="1" stroke="#d98235" fill="#d98235" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartSurface>

      <ChartSurface title="Energia, dolore e RIR" icon={<Activity />}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={recoveryData}>
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

function ChartSurface({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Surface className="chart-surface">
      <div className="surface-heading"><h2>{title}</h2>{icon}</div>
      {children}
    </Surface>
  );
}
