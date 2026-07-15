import type { Page } from "@playwright/test";

export const athleteId = "11111111-1111-4111-8111-111111111111";
export const coachId = "22222222-2222-4222-8222-222222222222";
export const planId = "33333333-3333-4333-8333-333333333333";
export const relationshipId = "44444444-4444-4444-8444-444444444444";

export const assignedPlan = {
  id: planId,
  name: "Piano Hybrid test",
  description: "Piano condiviso web e app",
  sessions: [
    { templateId: "lower-a", dayOfWeek: 1, displayName: "Lower forza", kind: "strength", estimatedMinutes: 45 },
    { templateId: "short-run", dayOfWeek: 2, displayName: "Corsa facile", kind: "run", estimatedMinutes: 30, runConfig: { type: "easy", durationMinutes: 30, workoutTemplateId: "run-template-easy-30", segments: [{ id: "seg-1", phase: "warmup", durationSeconds: 300, targetRpe: [2, 3], instructions: "Riscaldamento" }, { id: "seg-2", phase: "work", durationSeconds: 1200, targetRpe: [3, 4], instructions: "Ritmo facile" }, { id: "seg-3", phase: "cooldown", durationSeconds: 300, targetRpe: [1, 2], instructions: "Defaticamento" }] } },
    { templateId: "upper", dayOfWeek: 4, displayName: "Upper ipertrofia", kind: "strength", estimatedMinutes: 45 },
    { templateId: "main-run", dayOfWeek: 6, displayName: "Lungo", kind: "run", estimatedMinutes: 55, runConfig: { type: "long-easy", durationMinutes: 55 } },
  ],
  runSessions: [{ dayOfWeek: 2, type: "easy", durationMinutes: 30, workoutTemplateId: "run-template-easy-30" }, { dayOfWeek: 6, type: "long-easy", durationMinutes: 55 }],
  createdBy: coachId,
  createdAt: "2026-07-01T08:00:00.000Z",
  updatedAt: "2026-07-14T08:00:00.000Z",
};

function session(userId: string, email: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `test-token-${userId}`,
    refresh_token: `test-refresh-${userId}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: { id: userId, aud: "authenticated", role: "authenticated", email, email_confirmed_at: "2026-07-01T08:00:00.000Z", phone: "", confirmed_at: "2026-07-01T08:00:00.000Z", last_sign_in_at: "2026-07-14T08:00:00.000Z", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: "2026-07-01T08:00:00.000Z", updated_at: "2026-07-14T08:00:00.000Z" },
  };
}

export async function installSession(page: Page, userId: string, email: string) {
  const value = session(userId, email);
  await page.addInitScript(({ stored }) => {
    localStorage.setItem("sb-navyoqbpldsptejnnopk-auth-token", JSON.stringify(stored));
  }, { stored: value });
}

export async function mockPlatformApi(page: Page, role: "athlete" | "coach" | "admin", onboardingComplete = true) {
  const id = role === "athlete" ? athleteId : coachId;
  const email = role === "athlete" ? "alex@example.com" : role === "coach" ? "trainer@example.com" : "admin@example.com";
  await page.route("**/auth/v1/token**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session(id, email)) }));
  await page.route("**/api/me", (route) => route.fulfill({ json: { profile: { userId: id, email, displayName: role === "athlete" ? "Alex" : role === "coach" ? "Trainer Test" : "Admin Test", role } } }));
  await page.route("**/api/me/onboarding", async (route) => {
    if (route.request().method() === "PUT") return route.fulfill({ json: { completedAt: "2026-07-14T08:00:00.000Z", consentAcceptedAt: "2026-07-14T08:00:00.000Z", consentVersion: "2026-07-14" } });
    if (route.request().method() === "PATCH") return route.fulfill({ json: { consentAcceptedAt: "2026-07-14T08:00:00.000Z", consentVersion: "2026-07-14" } });
    return route.fulfill({ json: { profile: onboardingComplete ? { user_id: athleteId, display_name: "Alex", birth_year: null, primary_goal: "Allenamento ibrido", secondary_goals: [], training_days: [1, 2, 4, 6], equipment: ["Manubri", "Panca"], limitations: [], onboarding_completed_at: "2026-07-14T08:00:00.000Z", health_onboarding_skipped_at: "2026-07-14T08:00:00.000Z", consent_accepted_at: "2026-07-14T08:00:00.000Z", consent_version: "2026-07-14", created_at: "2026-07-14T08:00:00.000Z", updated_at: "2026-07-14T08:00:00.000Z" } : null } });
  });
  await page.route("**/api/plans/assigned", (route) => route.fulfill({ json: role === "athlete" ? { assignment: { id: "55555555-5555-4555-8555-555555555555", planId, athleteEmail: email, athleteUserId: athleteId, assignedBy: coachId, assignedAt: "2026-07-14T08:00:00.000Z", active: true }, plan: { ...assignedPlan, version: 1, changeReason: "Piano iniziale condiviso dal trainer." }, planVersion: { version: 1, reason: "Piano iniziale condiviso dal trainer.", createdAt: "2026-07-14T08:00:00.000Z" } } : { assignment: null, plan: null, planVersion: null } }));
  await page.route("**/api/external-workouts**", (route) => route.fulfill({ json: { workouts: [{ id: "66666666-6666-4666-8666-666666666666", external_id: "health-1", source: "apple_health", platform: "ios", workout_type: "functionalStrengthTraining", kind: "strength", start_date: "2026-07-13T17:00:00.000Z", end_date: "2026-07-13T17:45:00.000Z", duration_minutes: 45, distance_km: null, calories_kcal: 260, average_heart_rate: 112, max_heart_rate: 145, source_name: "Apple Watch", matched_template_id: null, matched_at: null, imported_at: "2026-07-13T18:00:00.000Z" }] } }));
  await page.route("**/api/sync/normalized**", (route) => route.fulfill({ json: { workouts: [], runs: [], readiness: [], followUps: [] } }));
  await page.route("**/api/notifications", (route) => route.fulfill({ json: { notifications: [{ id: "77777777-7777-4777-8777-777777777777", recipient_user_id: id, actor_user_id: coachId, type: "plan_updated", title: "Il tuo piano è stato aggiornato", body: "Nuova versione disponibile.", href: "/?tab=today", entity_type: "training_plan", entity_id: planId, created_at: "2026-07-14T08:30:00.000Z", read_at: null }] } }));
  await page.route("**/api/monitoring/errors", (route) => route.fulfill({ json: { recorded: true } }));
  await page.route("**/api/staff/clients", (route) => route.fulfill({ json: { clients: [{ id: relationshipId, trainer_user_id: coachId, athlete_user_id: athleteId, athlete_email: "alex@example.com", status: "active", invited_at: "2026-07-01T08:00:00.000Z", account: { user_id: athleteId, display_name: "Alex", email: "alex@example.com" }, profile: { primary_goal: "Allenamento ibrido", onboarding_completed_at: "2026-07-14T08:00:00.000Z" }, health: { status: "success", platform: "ios", last_successful_sync_at: "2026-07-14T07:00:00.000Z" } }] } }));
  await page.route(`**/api/staff/clients/${athleteId}`, (route) => route.fulfill({ json: { profile: { primary_goal: "Allenamento ibrido", training_days: [1, 2, 4, 6], equipment: ["Manubri", "Panca"], limitations: [] }, health: [{ platform: "ios", status: "success", last_successful_sync_at: "2026-07-14T07:00:00.000Z" }], plan: assignedPlan, metrics: { workouts: 7, runs: 5, followUps: 3, adherence: 88 }, calendar: [{ id: "activity-1", date: "2026-07-13", kind: "strength", status: "complete", source: "app", label: "Upper ipertrofia" }], external: [] } }));
  await page.route("**/api/analysis/suggestions**", (route) => route.fulfill({ json: { suggestions: [] } }));
  await page.route("**/api/plans", (route) => route.fulfill({ json: { plan: assignedPlan } }));
  await page.route("**/api/admin/users", (route) => route.fulfill({ json: { users: [] } }));
  await page.route("**/api/admin/audit", (route) => route.fulfill({ json: { events: [] } }));
  await page.route("**/api/admin/errors", (route) => route.fulfill({ json: { events: [] } }));
}
