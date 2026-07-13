import { jsonError, jsonOk } from "@/lib/api-utils";
import { getRemoteUserProfile } from "@/lib/supabase/profiles";
import { fetchStravaActivities, getStravaConnection, stravaConfigured } from "@/lib/strava-server";

export async function GET(request: Request) {
  if (!stravaConfigured()) return jsonError("Strava non configurato.", 503);

  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);

  const connection = await getStravaConnection(profile.userId);
  if (!connection) return jsonError("Strava non collegato.", 404);

  const { searchParams } = new URL(request.url);
  const afterDays = Number(searchParams.get("afterDays") ?? "30");
  const after = Math.floor(Date.now() / 1000) - afterDays * 86_400;

  const activities = await fetchStravaActivities(connection.accessToken, after);
  return jsonOk({ activities, syncedAt: new Date().toISOString() });
}
