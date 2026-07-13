import { TEMPLATES } from "./program";
import type { TemplateCustomization, TrainingPlan, WorkoutTemplate } from "./types";

export function applyTemplateCustomizations(
  templates: readonly WorkoutTemplate[],
  customizations: readonly TemplateCustomization[],
): WorkoutTemplate[] {
  const byTemplate = new Map(customizations.map((entry) => [entry.templateId, entry]));
  return templates.map((template) => {
    const custom = byTemplate.get(template.id);
    if (!custom) return template;
    return {
      ...template,
      name: custom.name,
      notes: custom.notes ?? template.notes,
      estimatedMinutes: custom.estimatedMinutes ?? template.estimatedMinutes,
    };
  });
}

export function planSessionsToCustomizations(plan: TrainingPlan): TemplateCustomization[] {
  const now = new Date().toISOString();
  return plan.sessions.map((session) => ({
    id: `custom-${session.templateId}`,
    templateId: session.templateId,
    name: session.displayName,
    notes: session.notes,
    estimatedMinutes: session.estimatedMinutes,
    updatedAt: now,
    updatedBy: plan.createdBy,
  }));
}

export function buildPlanFromTemplates(
  name: string,
  templates: readonly WorkoutTemplate[],
  createdBy: string,
): TrainingPlan {
  const now = new Date().toISOString();
  return {
    id: `plan-${Date.now()}`,
    name,
    description: "Piano personalizzato",
    sessions: templates.map((template) => ({
      templateId: template.id,
      dayOfWeek: template.dayOfWeek,
      displayName: template.name,
      kind: template.kind,
      estimatedMinutes: template.estimatedMinutes,
      notes: template.notes,
      prescriptions: template.kind === "strength" ? template.prescriptions : undefined,
      runConfig:
        template.kind === "run"
          ? {
              type: template.id === "main-run" ? "long-easy" : "easy",
              durationMinutes: template.estimatedMinutes,
              notes: template.notes,
            }
          : undefined,
    })),
    runSessions: templates
      .filter((template) => template.kind === "run")
      .map((template) => ({
        dayOfWeek: template.dayOfWeek,
        type: (template.id === "main-run" ? "long-easy" : "easy") as import("./types").RunSession["type"],
        durationMinutes: template.estimatedMinutes,
        notes: template.notes,
      })),
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

export function defaultTrainingPlan(createdBy = "system"): TrainingPlan {
  return buildPlanFromTemplates("Piano ibrido standard", TEMPLATES, createdBy);
}

export async function applyPlanLocally(plan: TrainingPlan) {
  const { db } = await import("./db");
  await db.trainingPlans.put(plan);
  await db.templateCustomizations.bulkPut(planSessionsToCustomizations(plan));
  if (plan.runSessions?.length) {
    const { applyCoachRunPlans } = await import("./db");
    await applyCoachRunPlans(plan.runSessions);
  }
}
