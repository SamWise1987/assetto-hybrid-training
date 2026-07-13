import { jsonError, jsonOk } from "@/lib/api-utils";
import { getRemoteUserProfile } from "@/lib/supabase/profiles";
import { buildStravaAuthUrl, stravaConfigured } from "@/lib/strava-server";

export async function GET(request: Request) {
  if (!stravaConfigured()) return jsonError("Strava non configurato sul server.", 503);

  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);

  const state = Buffer.from(JSON.stringify({ userId: profile.userId, ts: Date.now() })).toString("base64url");
  return jsonOk({ url: buildStravaAuthUrl(state) });
}
