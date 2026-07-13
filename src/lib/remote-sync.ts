"use client";

import { createBrowserSupabaseClient, getOrCreateDeviceId, isSupabaseConfigured } from "./supabase/client";
import type { SyncPayload } from "./supabase/sync";

export async function signInWithEmail(email: string) {
  const client = createBrowserSupabaseClient();
  if (!client) throw new Error("Supabase non configurato.");

  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/` },
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
