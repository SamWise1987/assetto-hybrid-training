import { describe, expect, it } from "vitest";
import { resolveTemplates } from "./templates";
import type { TrainingPlan, WorkoutTemplate } from "./types";

const base: WorkoutTemplate[] = [{
  id: "strength-a",
  dayOfWeek: 1,
  name: "Forza A",
  kind: "strength",
  estimatedMinutes: 45,
  prescriptions: [{
    id: "press",
    exerciseId: "press",
    sets: 3,
    repRange: [8, 10],
    targetRir: [1, 2],
    variant: "standard",
    tempo: "controllato",
    rangeOfMotion: "completo",
    difficultyLevel: 2,
    restSeconds: 90,
  }],
}];

function plan(sessions: TrainingPlan["sessions"]): TrainingPlan {
  return {
    id: "plan-1",
    name: "Piano trainer",
    sessions,
    createdBy: "trainer-1",
    createdAt: "2026-07-16T08:00:00.000Z",
    updatedAt: "2026-07-16T08:00:00.000Z",
  };
}

describe("resolveTemplates", () => {
  it("usa le sessioni del piano come fonte autorevole e include template nuovi", () => {
    const result = resolveTemplates(base, [], plan([
      { templateId: "lower-a", dayOfWeek: 1, displayName: "Lower forza", kind: "strength", estimatedMinutes: 50 },
      { templateId: "run-easy", dayOfWeek: 3, displayName: "Corsa facile", kind: "run", estimatedMinutes: 30 },
    ]));

    expect(result.map((item) => ({ id: item.id, name: item.name, kind: item.kind }))).toEqual([
      { id: "lower-a", name: "Lower forza", kind: "strength" },
      { id: "run-easy", name: "Corsa facile", kind: "run" },
    ]);
    expect(result.some((item) => item.id === "strength-a")).toBe(false);
  });

  it("preserva le prescrizioni base quando il piano rinomina un template esistente", () => {
    const [result] = resolveTemplates(base, [], plan([
      { templateId: "strength-a", dayOfWeek: 2, displayName: "Spinta aggiornata", kind: "strength", estimatedMinutes: 55 },
    ]));

    expect(result).toMatchObject({ id: "strength-a", dayOfWeek: 2, name: "Spinta aggiornata", estimatedMinutes: 55 });
    expect(result.prescriptions).toEqual(base[0].prescriptions);
  });
});
