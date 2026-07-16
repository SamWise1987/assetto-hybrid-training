import type { ExternalWorkout, RunSession, SessionKind, WorkoutSession } from "./types";

interface ScheduledTemplate {
  id: string;
  kind: SessionKind;
}

export function strengthSessionForTemplateDate(
  sessions: readonly Pick<WorkoutSession, "date" | "templateId" | "status">[],
  date: string,
  templateId: string,
) {
  return sessions.find((session) => session.date === date && session.templateId === templateId);
}

export function matchedExternalForTemplateDate(
  externalWorkouts: readonly Pick<ExternalWorkout, "startDate" | "matchedTemplateId">[],
  date: string,
  templateId: string,
) {
  return externalWorkouts.find((workout) => (
    workout.startDate.slice(0, 10) === date && workout.matchedTemplateId === templateId
  ));
}

export function isScheduledTemplateComplete(input: {
  date: string;
  template?: ScheduledTemplate;
  sessions: readonly Pick<WorkoutSession, "date" | "templateId" | "status">[];
  runs: readonly Pick<RunSession, "date" | "status">[];
  externalWorkouts: readonly Pick<ExternalWorkout, "startDate" | "matchedTemplateId">[];
}) {
  const { date, template, sessions, runs, externalWorkouts } = input;
  if (template?.kind === "run") {
    return runs.some((run) => run.date === date && run.status === "complete");
  }
  if (template?.kind !== "strength") return false;
  const session = strengthSessionForTemplateDate(sessions, date, template.id);
  return session?.status === "complete" || Boolean(matchedExternalForTemplateDate(externalWorkouts, date, template.id));
}
