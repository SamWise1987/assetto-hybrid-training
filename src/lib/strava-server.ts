import { createServiceSupabaseClient } from "./supabase/server";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API = "https://www.strava.com/api/v3";

export interface StravaConnection {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  externalAthleteId?: string;
}

export function stravaConfigured() {
  return Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}

export function buildStravaAuthUrl(state: string) {
  const clientId = process.env.STRAVA_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/strava/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    approval_prompt: "auto",
    scope: "read,activity:read",
    state,
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

async function exchangeToken(body: Record<string, string>) {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      ...body,
    }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Strava token exchange failed");
  }
  return response.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_at: number;
    athlete: { id: number };
  }>;
}

export async function exchangeStravaCode(code: string) {
  return exchangeToken({
    code,
    grant_type: "authorization_code",
  });
}

async function refreshStravaToken(refreshToken: string) {
  return exchangeToken({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
}

export async function getStravaConnection(userId: string): Promise<StravaConnection | null> {
  const service = createServiceSupabaseClient();
  if (!service) return null;

  const { data } = await service
    .from("service_connections")
    .select("user_id, access_token, refresh_token, expires_at, external_athlete_id")
    .eq("user_id", userId)
    .eq("provider", "strava")
    .maybeSingle();

  if (!data) return null;

  const expiresAt = new Date(data.expires_at);
  if (expiresAt.getTime() <= Date.now() + 60_000) {
    const refreshed = await refreshStravaToken(data.refresh_token);
    const newExpires = new Date(refreshed.expires_at * 1000).toISOString();
    await service
      .from("service_connections")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: newExpires,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", "strava");
    return {
      userId,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: newExpires,
      externalAthleteId: String(refreshed.athlete.id),
    };
  }

  return {
    userId,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    externalAthleteId: data.external_athlete_id ?? undefined,
  };
}

export async function saveStravaConnection(
  userId: string,
  tokens: { access_token: string; refresh_token: string; expires_at: number; athlete: { id: number } },
) {
  const service = createServiceSupabaseClient();
  if (!service) throw new Error("Supabase non configurato.");

  const expiresAt = new Date(tokens.expires_at * 1000).toISOString();
  const { error } = await service.from("service_connections").upsert(
    {
      user_id: userId,
      provider: "strava",
      external_athlete_id: String(tokens.athlete.id),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scopes: ["read", "activity:read"],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw new Error(error.message);
}

export async function deleteStravaConnection(userId: string) {
  const service = createServiceSupabaseClient();
  if (!service) return;
  await service.from("service_connections").delete().eq("user_id", userId).eq("provider", "strava");
}

export async function fetchStravaActivities(accessToken: string, after?: number) {
  const params = new URLSearchParams({ per_page: "30" });
  if (after) params.set("after", String(after));
  const response = await fetch(`${STRAVA_API}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Impossibile recuperare le attività Strava.");
  return response.json();
}
