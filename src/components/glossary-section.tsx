"use client";

import { BookOpen } from "lucide-react";
import { TRAINING_GLOSSARY } from "@/lib/glossary";
import { Surface } from "./ui";

export function GlossarySection({ compact = false }: { compact?: boolean }) {
  return (
    <Surface className={compact ? "glossary-panel is-compact" : "glossary-panel"}>
      <div className="surface-heading">
        <div>
          <p className="date-label">Riferimenti</p>
          <h2>Glossario allenamento</h2>
        </div>
        <BookOpen />
      </div>
      <p>Acronimi e termini che trovi in scheda, check-in e check-out.</p>
      <div className="glossary-list">
        {TRAINING_GLOSSARY.map((entry) => (
          <article key={entry.acronym}>
            <div>
              <strong>{entry.acronym}</strong>
              <span>{entry.title}</span>
            </div>
            <p>{entry.meaning}</p>
            <small>{entry.tip}</small>
          </article>
        ))}
      </div>
    </Surface>
  );
}
