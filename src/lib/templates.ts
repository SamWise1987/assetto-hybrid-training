import { TEMPLATES } from "./program";
import { applyTemplateCustomizations } from "./plans";
import type { PlanAssignment, TemplateCustomization, TrainingPlan, WorkoutTemplate } from "./types";

export function resolveTemplates(
  storedTemplates: readonly WorkoutTemplate[],
  customizations: readonly TemplateCustomization[],
  activePlan?: TrainingPlan | null,
): WorkoutTemplate[] {
  const base = storedTemplates.length ? [...storedTemplates] : [...TEMPLATES];
  const planCustomizations = activePlan
    ? activePlan.sessions.map((session) => ({
        id: `custom-${session.templateId}`,
        templateId: session.templateId,
        name: session.displayName,
        notes: session.notes,
        estimatedMinutes: session.estimatedMinutes,
        updatedAt: activePlan.updatedAt,
        updatedBy: activePlan.createdBy,
      }))
    : customizations;

  return applyTemplateCustomizations(base, planCustomizations);
}

export function getTemplateForDay(
  day: number,
  templates: readonly WorkoutTemplate[],
) {
  return templates.find((template) => template.dayOfWeek === day) ?? templates[0];
}

export function getActiveAssignment(
  assignments: readonly PlanAssignment[],
  email?: string | null,
) {
  if (!email) return null;
  return (
    assignments.find(
      (assignment) => assignment.active && assignment.athleteEmail.toLowerCase() === email.toLowerCase(),
    ) ?? null
  );
}

export function templateNameMap(templates: readonly WorkoutTemplate[]) {
  return Object.fromEntries(templates.map((template) => [template.id, template.name]));
}
