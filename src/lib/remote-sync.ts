"use client";

import { createBrowserSupabaseClient, getOrCreateDeviceId, isSupabaseConfigured } from "./supabase/client";
import type { SyncPayload } from "./supabase/sync";
import type { ExternalWorkout } from "./types";

export async function signInWithEmail(email: string) {
  const client = createBrowserSupabaseClient();
  if (!client) throw new Error("Servizio di accesso non disponibile.");

  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/` },
  });
  if (error) throw new Error(error.message);
}

export async function signInWithPassword(email: string, password: string) {
  const client = createBrowserSupabaseClient();
  if (!client) throw new Error("Servizio di accesso non disponibile.");

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function updateRemotePassword(password: string) {
  const client = createBrowserSupabaseClient();
  if (!client) throw new Error("Servizio di accesso non disponibile.");
  const { error } = await client.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function getRemoteSession() {
  const client = createBrowserSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

export function onRemoteAuthChange(callback: (authenticated: boolean) => void) {
  const client = createBrowserSupabaseClient();
  if (!client) return () => undefined;
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(Boolean(session)));
  return () => data.subscription.unsubscribe();
}

export async function consumeRemoteAuthCallback(callbackUrl: string) {
  const client = createBrowserSupabaseClient();
  if (!client) return false;
  const params = getRemoteAuthCallbackParams(callbackUrl);
  const code = params.get("code");
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return false;
  const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) throw error;
  return true;
}

export function getRemoteAuthCallbackParams(callbackUrl: string) {
  const url = new URL(callbackUrl);
  const params = new URLSearchParams(url.search);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  hashParams.forEach((value, key) => params.set(key, value));
  return params;
}

export async function sendPasswordReset(email: string) {
  const client = createBrowserSupabaseClient();
  if (!client) throw new Error("Servizio di accesso non disponibile.");

  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
  });
  if (error) throw new Error(error.message);
}

export async function signOutRemote() {
  const client = createBrowserSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
}

export async function getRemoteAccessToken() {
  const client = createBrowserSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function getRemoteUserEmail() {
  const client = createBrowserSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user?.email ?? null;
}

export async function syncAccountProfile() {
  const token = await getRemoteAccessToken();
  if (!token) return null;
  const response = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    profile: { userId: string; email: string; displayName: string; role: "admin" | "coach" | "athlete"; updatedAt?: string };
  };
  const { db, prepareAccountCache } = await import("./db");
  await prepareAccountCache(body.profile.userId);
  await db.accountProfiles.put({
    id: "account-profile",
    userId: body.profile.userId,
    email: body.profile.email,
    displayName: body.profile.displayName,
    role: body.profile.role,
    updatedAt: body.profile.updatedAt ?? new Date().toISOString(),
  });
  const localProfile = await db.profiles.toCollection().first();
  if (localProfile && localProfile.name !== body.profile.displayName) {
    await db.profiles.put({ ...localProfile, name: body.profile.displayName });
  }

  const { syncAssignedPlanFromCloud } = await import("./plan-sync");
  await syncAssignedPlanFromCloud().catch(() => undefined);

  return body.profile;
}

export async function pushSnapshotToCloud(payload: SyncPayload, consent = false) {
  const token = await getRemoteAccessToken();
  if (!token) throw new Error("Accedi con email per sincronizzare.");

  const response = await fetch("/api/sync/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      deviceId: getOrCreateDeviceId(),
      payload,
      consent,
    }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ error: "Sync push fallita" }))) as {
      error?: string;
    };
    throw new Error(error.error ?? "Sync push fallita.");
  }

  return response.json();
}

export async function pullSnapshotFromCloud(deviceId?: string) {
  const token = await getRemoteAccessToken();
  if (!token) throw new Error("Accedi con email per sincronizzare.");

  const query = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : "";
  const response = await fetch(`/api/sync/pull${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ error: "Sync pull fallita" }))) as {
      error?: string;
    };
    throw new Error(error.error ?? "Sync pull fallita.");
  }

  const body = (await response.json()) as { payload: SyncPayload | null };
  return body.payload;
}

export function cloudSyncAvailable() {
  return isSupabaseConfigured();
}

export async function pushExternalWorkouts(
  workouts: ExternalWorkout[],
  state?: { platform: "ios" | "android"; status: "success" | "denied" | "error"; lastAttemptAt: string; lastSuccessfulSyncAt?: string; imported: number; skipped: number; errorMessage?: string },
) {
  const token = await getRemoteAccessToken();
  if (!token) return { synced: 0 };
  const response = await fetch("/api/external-workouts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ workouts, healthState: state }),
  });
  if (!response.ok) throw new Error("Sincronizzazione attività Health non riuscita.");
  return response.json() as Promise<{ synced: number }>;
}

export async function pullExternalWorkoutsFromCloud() {
  const token = await getRemoteAccessToken();
  if (!token) return [];
  const response = await fetch("/api/external-workouts", { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return [];
  const body = await response.json() as { workouts: Array<{
    id: string; external_id: string; source: ExternalWorkout["source"]; platform: ExternalWorkout["platform"];
    workout_type: string; kind: ExternalWorkout["kind"]; start_date: string; end_date: string;
    duration_minutes: number; distance_km: number | null; calories_kcal: number | null;
    average_heart_rate: number | null; max_heart_rate: number | null; source_name: string | null;
    matched_template_id: string | null; matched_at: string | null; imported_at: string;
  }> };
  const workouts: ExternalWorkout[] = body.workouts.map((item) => ({
    id: item.id, externalId: item.external_id, source: item.source, platform: item.platform,
    workoutType: item.workout_type, kind: item.kind, startDate: item.start_date, endDate: item.end_date,
    durationMinutes: item.duration_minutes, distanceKm: item.distance_km ?? undefined,
    caloriesKcal: item.calories_kcal ?? undefined, averageHeartRate: item.average_heart_rate ?? undefined,
    maxHeartRate: item.max_heart_rate ?? undefined, sourceName: item.source_name ?? undefined,
    matchedTemplateId: item.matched_template_id ?? undefined, matchedAt: item.matched_at ?? undefined,
    importedAt: item.imported_at, syncedAt: new Date().toISOString(),
  }));
  const { db } = await import("./db");
  if (workouts.length) await db.externalWorkouts.bulkPut(workouts);
  return workouts;
}

export async function pullAthleteProfileFromCloud() {
  const token = await getRemoteAccessToken();
  if (!token) return null;
  const response = await fetch("/api/me/onboarding", { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  const body = await response.json() as { profile: null | {
    user_id: string; display_name: string; birth_year: number | null; primary_goal: string; secondary_goals: string[];
    training_days: number[]; equipment: string[]; limitations: string[]; onboarding_completed_at: string | null;
    health_onboarding_skipped_at: string | null; created_at: string; updated_at: string;
    consent_accepted_at: string | null; consent_version: string | null;
  } };
  if (!body.profile?.onboarding_completed_at) return null;
  const { db, seedInitialData } = await import("./db");
  if (!(await db.profiles.count())) await seedInitialData({ name: body.profile.display_name, preferredGreeting: "neutral" });
  await db.athleteProfiles.put({
    id: "athlete-profile", userId: body.profile.user_id, displayName: body.profile.display_name,
    birthYear: body.profile.birth_year ?? undefined, primaryGoal: body.profile.primary_goal,
    secondaryGoals: body.profile.secondary_goals, trainingDays: body.profile.training_days,
    equipment: body.profile.equipment, limitations: body.profile.limitations,
    onboardingCompletedAt: body.profile.onboarding_completed_at,
    healthOnboardingSkippedAt: body.profile.health_onboarding_skipped_at ?? undefined,
    consentAcceptedAt: body.profile.consent_accepted_at ?? undefined,
    consentVersion: body.profile.consent_version ?? undefined,
    updatedAt: body.profile.updated_at,
  });
  return body.profile;
}

export async function migrateLocalDataForAccount(userId: string) {
  const { db, enqueueSync, exportDatabase } = await import("./db");
  const settings = await db.appSettings.get("app-settings");
  if (settings?.localDataMigratedForUserId === userId) return false;
  const [workouts, runs, readiness, followUps, externalWorkouts, localProfile, safety, templates, equipment] = await Promise.all([
    db.workoutSessions.toArray(),
    db.runs.toArray(),
    db.readiness.toArray(),
    db.nextDayResponses.toArray(),
    db.externalWorkouts.toArray(),
    db.profiles.toCollection().first(),
    db.safetyProfiles.toCollection().first(),
    db.templates.toArray(),
    db.equipment.toArray(),
  ]);
  const hasLocalData = workouts.length + runs.length + readiness.length + followUps.length + externalWorkouts.length > 0 || Boolean(localProfile);
  if (hasLocalData) {
    // Keep the legacy snapshot as a temporary recovery point while also
    // populating the normalized cross-device model.
    await pushSnapshotToCloud(await exportDatabase(), true);
    await Promise.all([
      ...workouts.map((item) => enqueueSync({ entity: "workout" as const, entityId: item.id, operation: "upsert" as const, payload: item as unknown as Record<string, unknown> })),
      ...runs.map((item) => enqueueSync({ entity: "run" as const, entityId: item.id, operation: "upsert" as const, payload: item as unknown as Record<string, unknown> })),
      ...readiness.map((item) => enqueueSync({ entity: "readiness" as const, entityId: item.id, operation: "upsert" as const, payload: item as unknown as Record<string, unknown> })),
      ...followUps.map((item) => enqueueSync({ entity: "follow_up" as const, entityId: item.id, operation: "upsert" as const, payload: item as unknown as Record<string, unknown> })),
      ...externalWorkouts.map((item) => enqueueSync({ entity: "external_workout" as const, entityId: item.id, operation: "upsert" as const, payload: item as unknown as Record<string, unknown> })),
    ]);
    if (localProfile) {
      const token = await getRemoteAccessToken();
      const trainingDays = [...new Set(templates.filter((item) => item.kind !== "free").map((item) => item.dayOfWeek))].sort();
      if (token) {
        await fetch("/api/me/onboarding", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            displayName: localProfile.name,
            primaryGoal: localProfile.primaryGoal,
            trainingDays,
            equipment: equipment.map((item) => item.label),
            limitations: safety?.limitations ?? [],
            healthSkipped: true,
          }),
        }).then((response) => {
          if (!response.ok) throw new Error("Migrazione profilo non riuscita.");
        });
      }
    }
    const { flushSyncQueue } = await import("./normalized-sync");
    await flushSyncQueue();
  }
  await db.appSettings.put({
    ...(settings ?? { id: "app-settings", aiCoachEnabled: false, aiModel: "gpt-4.1-mini" }),
    localDataMigratedForUserId: userId,
  });
  return hasLocalData;
}
