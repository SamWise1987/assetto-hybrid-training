"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import type { RunningWorkoutSegment } from "@/lib/types";
import {
  advanceRunWorkoutClock,
  createRunWorkoutPlayerState,
  expandRunningWorkoutSegments,
  formatRunWorkoutClock,
  moveRunWorkoutStep,
  runWorkoutProgress,
  startOrPauseRunWorkout,
} from "@/lib/run-workout-player";
import { Button, Surface } from "../../ui";

const PHASE_LABELS: Record<RunningWorkoutSegment["phase"], string> = {
  warmup: "Riscaldamento",
  work: "Lavoro",
  recovery: "Recupero",
  cooldown: "Defaticamento",
};

export function RunWorkoutPlayer({ segments }: { segments: readonly RunningWorkoutSegment[] }) {
  const steps = useMemo(() => expandRunningWorkoutSegments(segments), [segments]);
  const [player, setPlayer] = useState(() => createRunWorkoutPlayerState(steps));
  const lastTickAt = useRef<number | null>(null);

  useEffect(() => {
    if (player.status !== "running") {
      lastTickAt.current = null;
      return;
    }

    lastTickAt.current = Date.now();
    const tick = () => {
      const now = Date.now();
      const previous = lastTickAt.current ?? now;
      const elapsedSeconds = Math.floor((now - previous) / 1_000);
      if (elapsedSeconds < 1) return;
      lastTickAt.current = previous + elapsedSeconds * 1_000;
      setPlayer((current) => advanceRunWorkoutClock(current, steps, elapsedSeconds));
    };

    const interval = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [player.status, steps]);

  if (!steps.length) return null;

  const active = steps[player.activeIndex];
  const complete = player.status === "complete";
  const timed = typeof active.durationSeconds === "number" && active.durationSeconds > 0;
  const distanceTarget = typeof active.distanceMeters === "number" && active.distanceMeters > 0
    ? `${active.distanceMeters} m`
    : "Manuale";
  const repeatLabel = active.repeatTotal > 1 ? ` · ripetizione ${active.repeatIndex} di ${active.repeatTotal}` : "";
  const progress = runWorkoutProgress(player, steps);
  const primaryLabel = player.status === "idle"
    ? "Avvia workout"
    : player.status === "running"
      ? "Metti in pausa"
      : "Riprendi workout";

  return (
    <Surface className={`run-workout-player is-${player.status}`}>
      <div className="surface-heading">
        <div><p className="date-label">Player workout</p><h2>Sequenza guidata</h2></div>
        <span className="run-player-total">{formatRunWorkoutClock(player.totalElapsedSeconds)} trascorsi</span>
      </div>

      <progress
        className="run-player-progress"
        max={steps.length}
        value={progress * steps.length}
        aria-label="Avanzamento workout corsa"
      />

      {complete ? (
        <div className="run-player-complete" role="status">
          <strong>Sequenza completata</strong>
          <p>Registra qui sotto durata, distanza e sensazioni realmente rilevate.</p>
          <Button variant="secondary" onClick={() => setPlayer(createRunWorkoutPlayerState(steps))}>
            <RotateCcw aria-hidden="true" /> Ricomincia sequenza
          </Button>
        </div>
      ) : (
        <>
          <p className="visually-hidden" aria-live="polite">
            Passaggio {player.activeIndex + 1}: {PHASE_LABELS[active.phase]}{repeatLabel}
          </p>
          <div className="run-player-current">
            <p>Passaggio {player.activeIndex + 1} di {steps.length}</p>
            <h3>{PHASE_LABELS[active.phase]}{repeatLabel}</h3>
            <div className={`run-player-clock ${!timed && !active.distanceMeters ? "is-manual" : ""}`} role="timer" aria-label={timed ? "Tempo residuo del passaggio" : "Obiettivo del passaggio"}>
              <strong>{timed ? formatRunWorkoutClock(player.remainingSeconds ?? active.durationSeconds ?? 0) : distanceTarget}</strong>
              <span>{timed ? "rimanenti" : `${formatRunWorkoutClock(player.stepElapsedSeconds)} nel tratto · avanza quando completato`}</span>
            </div>
            <p className="run-player-instructions">{active.instructions}</p>
            <div className="run-player-targets" aria-label="Obiettivi del passaggio">
              {active.targetRpe ? <span>RPE {active.targetRpe.join("–")}</span> : null}
              {active.targetPace ? <span>Ritmo {active.targetPace}</span> : null}
              {active.targetHeartRateZone ? <span>FC {active.targetHeartRateZone}</span> : null}
            </div>
          </div>

          <div className="run-player-actions">
            <Button
              variant="ghost"
              aria-label="Passaggio precedente"
              disabled={player.activeIndex === 0}
              onClick={() => setPlayer((current) => moveRunWorkoutStep(current, steps, -1))}
            >
              <ChevronLeft aria-hidden="true" /> Indietro
            </Button>
            <Button onClick={() => setPlayer((current) => startOrPauseRunWorkout(current))}>
              {player.status === "running" ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              {primaryLabel}
            </Button>
            <Button
              variant="ghost"
              aria-label={player.activeIndex === steps.length - 1 ? "Completa sequenza" : "Passaggio successivo"}
              onClick={() => setPlayer((current) => moveRunWorkoutStep(current, steps, 1))}
            >
              {player.activeIndex === steps.length - 1 ? "Completa" : "Avanti"} <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </>
      )}

      <ol className="run-player-overview" aria-label="Sequenza completa">
        {steps.map((step, index) => (
          <li key={step.stepId} className={index === player.activeIndex && !complete ? "is-current" : index < player.activeIndex || complete ? "is-complete" : ""}>
            <span>{index + 1}</span>
            <div>
              <strong>{PHASE_LABELS[step.phase]}{step.repeatTotal > 1 ? ` ${step.repeatIndex}/${step.repeatTotal}` : ""}</strong>
              <small>{step.distanceMeters ? `${step.distanceMeters} m` : formatRunWorkoutClock(step.durationSeconds ?? 0)} · {step.instructions}</small>
            </div>
          </li>
        ))}
      </ol>
    </Surface>
  );
}
