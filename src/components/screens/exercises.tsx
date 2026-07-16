"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Dumbbell, Search, ShieldCheck } from "lucide-react";
import { getAllExercises, getExerciseCount, getExercisePatterns } from "@/lib/exercise-library";
import { EmptyState, Field } from "../ui";
import { handleRovingTabKey } from "@/lib/keyboard-navigation";

export function ExercisesScreen() {
  const [query, setQuery] = useState("");
  const [pattern, setPattern] = useState("tutti");
  const exercises = useMemo(() => getAllExercises(), []);
  const patterns = useMemo(() => getExercisePatterns(), []);
  const patternTabs = useMemo(() => ["tutti", ...patterns], [patterns]);

  const filtered = exercises.filter((exercise) => {
    const haystack = `${exercise.name} ${exercise.pattern} ${exercise.muscleGroups.join(" ")} ${exercise.equipment?.join(" ") ?? ""}`.toLowerCase();
    const matchesQuery = haystack.includes(query.toLowerCase());
    const matchesPattern = pattern === "tutti" || exercise.pattern === pattern;
    return matchesQuery && matchesPattern;
  });

  return (
    <div className="screen-stack">
      <header className="section-heading">
        <p className="date-label">Libreria completa</p>
        <h1>Esercizi</h1>
        <p>{getExerciseCount()} esercizi disponibili con immagini, muscoli coinvolti e attrezzatura.</p>
      </header>

      <div className="search-field">
        <Search aria-hidden="true" />
        <Field label="Cerca per nome, muscolo o attrezzatura" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      <div className="filter-chips" role="tablist" aria-label="Filtra per categoria">
        {patternTabs.map((entry, index) => (
          <button
            key={entry}
            id={`exercise-pattern-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={pattern === entry}
            aria-controls="exercise-library-panel"
            tabIndex={pattern === entry ? 0 : -1}
            className={pattern === entry ? "is-active" : ""}
            onClick={() => setPattern(entry)}
            onKeyDown={(event) => handleRovingTabKey(event, patternTabs, pattern, setPattern)}
          >
            {entry === "tutti" ? "Tutti" : entry}
          </button>
        ))}
      </div>

      <div id="exercise-library-panel" role="tabpanel" aria-labelledby={`exercise-pattern-tab-${patternTabs.indexOf(pattern)}`}>
        <p className="visually-hidden" role="status">{filtered.length} esercizi mostrati</p>
        {filtered.length ? (
          <div className="exercise-library">
            {filtered.map((exercise) => (
              <article key={exercise.id} className="exercise-card">
                <div className="exercise-card-media">
                  {exercise.imageUrl ? (
                    <Image
                      src={exercise.imageUrl}
                      alt={exercise.name}
                      width={400}
                      height={300}
                      unoptimized
                    />
                  ) : (
                    <div className="exercise-card-placeholder" aria-hidden="true">
                      <Dumbbell />
                    </div>
                  )}
                </div>
                <div className="exercise-card-body">
                  <div className="exercise-title">
                    <div>
                      <span>{exercise.pattern}</span>
                      <h2>{exercise.name}</h2>
                    </div>
                    {exercise.safetyNotes ? <ShieldCheck aria-label="Note di sicurezza disponibili" /> : null}
                  </div>
                  <p>{exercise.muscleGroups.join(" · ")}</p>
                  {exercise.equipment?.length ? (
                    <p className="exercise-equipment">{exercise.equipment.join(" · ")}</p>
                  ) : null}
                  {exercise.description ? <p className="exercise-description">{exercise.description}</p> : null}
                  {exercise.substitutions.length ? (
                    <div>
                      <strong>Varianti</strong>
                      <ol>
                        {exercise.substitutions.map((substitution) => (
                          <li key={substitution}>{substitution}</li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                  {exercise.safetyNotes ? <aside>{exercise.safetyNotes.join(" · ")}</aside> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Nessun esercizio trovato" text="Prova un altro termine di ricerca o cambia categoria." />
        )}
      </div>
    </div>
  );
}
