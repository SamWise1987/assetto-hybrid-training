import type { SuggestionStatus, TrainingPlanSession } from "./types";

const transitions: Record<SuggestionStatus, SuggestionStatus[]> = {
  proposed: ["modified", "approved", "rejected"],
  modified: ["modified", "approved", "rejected"],
  approved: ["modified", "applied", "rejected"],
  applied: ["undone"],
  rejected: [],
  undone: [],
};

export function canTransitionSuggestion(from: SuggestionStatus, to: SuggestionStatus) {
  return transitions[from].includes(to);
}

export function suggestionPatchIsUnchanged(
  currentStatus: SuggestionStatus,
  nextStatus: SuggestionStatus,
  hasContentEdits: boolean,
) {
  return currentStatus === nextStatus && (nextStatus !== "modified" || !hasContentEdits);
}

export function applySuggestionToPlan(
  plan: { name: string; description: string | null; sessions: TrainingPlanSession[] },
  proposed: Record<string, unknown>,
) {
  const next: { name: string; description: string | null; sessions: TrainingPlanSession[] } = {
    ...plan,
    sessions: plan.sessions.map((session) => ({ ...session, ...(session.runConfig ? { runConfig: { ...session.runConfig } } : {}) })),
  };
  if (typeof proposed.name === "string" && proposed.name.trim()) next.name = proposed.name.trim();
  if (typeof proposed.description === "string") next.description = proposed.description;
  if (typeof proposed.planDescription === "string") next.description = proposed.planDescription;
  if (Array.isArray(proposed.sessions)) next.sessions = proposed.sessions as TrainingPlanSession[];
  if (typeof proposed.runDurationPercent === "number" && Number.isFinite(proposed.runDurationPercent)) {
    const factor = 1 + Math.max(-30, Math.min(30, proposed.runDurationPercent)) / 100;
    next.sessions = next.sessions.map((session) => session.runConfig ? {
      ...session,
      estimatedMinutes: Math.max(5, Math.round(session.estimatedMinutes * factor)),
      runConfig: { ...session.runConfig, durationMinutes: Math.max(5, Math.round(session.runConfig.durationMinutes * factor)) },
    } : session);
  }
  return next;
}
