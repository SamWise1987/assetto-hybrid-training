"use client";

import { useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { EXERCISES } from "@/lib/program";
import { EmptyState, Field } from "../ui";

export function ExercisesScreen() {
  const [query, setQuery] = useState("");
  const filtered = EXERCISES.filter((exercise) => `${exercise.name} ${exercise.pattern} ${exercise.muscleGroups.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="screen-stack"><header className="section-heading"><p className="date-label">Libreria ordinata</p><h1>Esercizi</h1><p>Varianti disponibili per l’attrezzatura attuale, con facilitazioni in ordine.</p></header><div className="search-field"><Search /><Field label="Cerca per nome, pattern o muscolo" value={query} onChange={(event) => setQuery(event.target.value)} /></div>{filtered.length ? <div className="exercise-library">{filtered.map((exercise) => <article key={exercise.id}><div className="exercise-title"><div><span>{exercise.pattern}</span><h2>{exercise.name}</h2></div>{exercise.safetyNotes ? <ShieldCheck aria-label="Note di sicurezza disponibili" /> : null}</div><p>{exercise.muscleGroups.join(" · ")}</p>{exercise.substitutions.length ? <div><strong>Facilitazioni / progressioni</strong><ol>{exercise.substitutions.map((substitution) => <li key={substitution}>{substitution}</li>)}</ol></div> : null}{exercise.safetyNotes ? <aside>{exercise.safetyNotes.join(" · ")}</aside> : null}</article>)}</div> : <EmptyState title="Nessun esercizio trovato" text="Prova un pattern come spinta, squat o core." />}</div>;
}
