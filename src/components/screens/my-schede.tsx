"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, ClipboardList, Footprints } from "lucide-react";
import { getResolvedTemplates } from "@/lib/db";
import { getExerciseById } from "@/lib/exercise-library";
import { TEMPLATES } from "@/lib/program";
import { useAppStore } from "@/lib/store";
import { GlossarySection } from "../glossary-section";
import { Button, EmptyState, Surface } from "../ui";

const DAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

/** Vista cliente: solo le schede assegnate, non la libreria completa. */
export function MySchedeScreen() {
  const templates = useLiveQuery(() => getResolvedTemplates(), [], TEMPLATES) ?? TEMPLATES;
  const { setTab } = useAppStore();
  const [openId, setOpenId] = useState<string | null>(null);

  const schede = useMemo(
    () =>
      [...templates]
        .filter((template) => template.kind === "strength" || template.kind === "run")
        .sort((a, b) => {
          const order = [1, 2, 3, 4, 5, 6, 0];
          return order.indexOf(a.dayOfWeek) - order.indexOf(b.dayOfWeek);
        }),
    [templates],
  );

  if (!schede.length) {
    return (
      <div className="screen-stack">
        <header className="section-heading">
          <p className="date-label">Le tue schede</p>
          <h1>Esercizi</h1>
          <p>Qui vedi solo gli allenamenti assegnati a te.</p>
        </header>
        <EmptyState title="Nessuna scheda" text="Quando il trainer ti assegna un piano, le schede appariranno qui." />
      </div>
    );
  }

  return (
    <div className="screen-stack">
      <header className="section-heading">
        <p className="date-label">Le tue schede</p>
        <h1>Esercizi</h1>
        <p>Solo i tuoi allenamenti: esercizi, carichi, pause e hint. Nessuna libreria generale.</p>
      </header>

      <div className="my-schede-list">
        {schede.map((template) => {
          const isOpen = openId === template.id;
          return (
            <Surface key={template.id} className="my-scheda-card">
              <button
                type="button"
                className="my-scheda-toggle"
                aria-expanded={isOpen}
                onClick={() => setOpenId(isOpen ? null : template.id)}
              >
                <div>
                  <span>{DAYS[template.dayOfWeek]}</span>
                  <h2>{template.name}</h2>
                  <p>
                    {template.kind === "run"
                      ? `${template.estimatedMinutes} min · corsa`
                      : `${template.prescriptions.length} esercizi · circa ${template.estimatedMinutes} min`}
                  </p>
                </div>
                {template.kind === "run" ? <Footprints /> : <ClipboardList />}
              </button>

              {isOpen ? (
                <div className="my-scheda-body">
                  {template.kind === "run" ? (
                    <ul>
                      {(template.notes?.length ? template.notes : ["Segui il piano corsa del giorno"]).map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : (
                    <ol className="scheda-list">
                      {template.prescriptions.map((prescription, index) => {
                        const exercise = getExerciseById(prescription.exerciseId);
                        return (
                          <li key={prescription.id} className="scheda-item">
                            <div className="scheda-item-head">
                              <span>{index + 1}</span>
                              <div>
                                <strong>{exercise?.name ?? prescription.exerciseId}</strong>
                                <p>{exercise?.pattern}</p>
                              </div>
                            </div>
                            <dl className="scheda-meta">
                              <div>
                                <dt>Volume</dt>
                                <dd>
                                  {prescription.secondsRange
                                    ? `${prescription.sets} × ${prescription.secondsRange.join("–")} s`
                                    : `${prescription.sets} × ${prescription.repRange?.join("–") ?? "—"}`}
                                </dd>
                              </div>
                              <div>
                                <dt>RIR</dt>
                                <dd>{prescription.targetRir.join("–")}</dd>
                              </div>
                              <div>
                                <dt>Carico</dt>
                                <dd>
                                  {prescription.targetLoadKg != null
                                    ? `${prescription.targetLoadKg} kg`
                                    : prescription.variant !== "standard"
                                      ? prescription.variant
                                      : "da registrare"}
                                </dd>
                              </div>
                              <div>
                                <dt>Pausa</dt>
                                <dd>{prescription.restSeconds ?? 90} s</dd>
                              </div>
                            </dl>
                            {prescription.hint ? <p className="scheda-hint">{prescription.hint}</p> : null}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  <Button variant="secondary" onClick={() => setTab("today")}>
                    Vai a Oggi <ArrowRight />
                  </Button>
                </div>
              ) : null}
            </Surface>
          );
        })}
      </div>

      <GlossarySection compact />
    </div>
  );
}
