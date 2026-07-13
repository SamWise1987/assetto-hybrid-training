"use client";

import { createBrowserSupabaseClient, getOrCreateDeviceId, isSupabaseConfigured } from "./supabase/client";
import type { SyncPayload } from "./supabase/sync";

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

export async function sendPasswordReset(email: string) {
  const client = createBrowserSupabaseClient();
  if (!client) throw new Error("Servizio di accesso non disponibile.");

  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/`,
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
    profile: { userId: string; email: string; displayName: string; role: "admin" | "coach" | "athlete" };
  };
  const { db } = await import("./db");
  await db.accountProfiles.put({
    id: "account-profile",
    userId: body.profile.userId,
    email: body.profile.email,
    displayName: body.profile.displayName,
    role: body.profile.role,
    updatedAt: new Date().toISOString(),
  });
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
