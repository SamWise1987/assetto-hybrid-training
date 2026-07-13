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

  const customized = applyTemplateCustomizations(base, planCustomizations);

  if (!activePlan) return customized;

  const sessionOverrides = new Map(activePlan.sessions.map((session) => [session.templateId, session]));
  return customized.map((template) => {
    const session = sessionOverrides.get(template.id);
    if (!session?.prescriptions?.length) return template;
    return {
      ...template,
      prescriptions: session.prescriptions,
      notes: session.notes ?? template.notes,
      estimatedMinutes: session.estimatedMinutes ?? template.estimatedMinutes,
    };
  });
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
