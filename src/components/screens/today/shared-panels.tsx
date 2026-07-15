"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { db, enqueueSync } from "@/lib/db";
import { Button, ScaleControl, Toggle } from "../../ui";

const isoToday = new Date().toISOString().slice(0, 10);

export function ScreenHeader({
  title,
  onBack,
  caption,
}: {
  title: string;
  onBack: () => void;
  caption?: string;
}) {
  return (
    <header className="flow-header">
      <button type="button" onClick={onBack} aria-label="Indietro"><ArrowLeft /></button>
      <div><h1>{title}</h1>{caption ? <p>{caption}</p> : null}</div>
    </header>
  );
}

export function CompletionPanel({ onHome }: { onHome: () => void }) {
  const latest = useLiveQuery(() => db.workoutSessions.orderBy("date").last());
  const durationLabel = latest?.durationPrecise
    ?? (latest?.durationMinutes != null ? `${latest.durationMinutes} min` : null);

  return (
    <div className="flow-screen completion-screen">
      <span className="completion-icon"><Check /></span>
      <p className="date-label">Seduta registrata</p>
      <h1>Fatto. Il piano si è aggiornato.</h1>
      {durationLabel ? (
        <aside className="session-duration-card">
          <p className="date-label">Tempo sulla scheda</p>
          <strong>{durationLabel}</strong>
          <span>Dal momento in cui hai iniziato fino al check-out</span>
        </aside>
      ) : null}
      <p>Le modifiche automatiche sono visibili in Progressi. Per l’upper body registra la risposta nelle 24 ore.</p>
      <Button onClick={onHome}>Torna a Oggi</Button>
    </div>
  );
}

export function NextDayPanel({ onBack }: { onBack: () => void }) {
  const latestSession = useLiveQuery(() => db.workoutSessions.orderBy("date").last());
  const [shoulder, setShoulder] = useState(true);
  const [cervical, setCervical] = useState(true);
  const [recovery, setRecovery] = useState(4);
  const [saved, setSaved] = useState(false);

  return (
    <div className="flow-screen">
      <ScreenHeader title="Risposta nelle 24 ore" caption="Obbligatoria per le progressioni upper body." onBack={onBack} />
      <Toggle label="Spalla tornata al livello precedente" checked={shoulder} onChange={setShoulder} />
      <Toggle label="Cervicale tornata al livello precedente" checked={cervical} onChange={setCervical} />
      <ScaleControl label="Recupero percepito" value={recovery} min={1} max={5} lowLabel="Scarso" highLabel="Ottimo" onChange={setRecovery} />
      {saved ? (
        <p className="success-message"><Check /> Risposta registrata. Il motore potrà valutarla.</p>
      ) : (
        <Button
          onClick={async () => {
            if (latestSession) {
              const response = {
                id: `next-${latestSession.id}`,
                sessionId: latestSession.id,
                date: isoToday,
                shoulderBackToBaseline: shoulder,
                cervicalBackToBaseline: cervical,
                perceivedRecovery: recovery as 1 | 2 | 3 | 4 | 5,
              };
              await db.nextDayResponses.put(response);
              await enqueueSync({ entity: "follow_up", entityId: response.id, operation: "upsert", payload: response });
            }
            setSaved(true);
          }}
        >
          Registra risposta
        </Button>
      )}
    </div>
  );
}
