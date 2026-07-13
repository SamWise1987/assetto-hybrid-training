import { jsonError, jsonOk } from "@/lib/api-utils";
import { getRemoteUserProfile } from "@/lib/supabase/profiles";
import { deleteStravaConnection, getStravaConnection, stravaConfigured } from "@/lib/strava-server";

export async function GET(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);

  if (!stravaConfigured()) return jsonOk({ configured: false, connected: false });

  const connection = await getStravaConnection(profile.userId);
  return jsonOk({
    configured: true,
    connected: Boolean(connection),
    athleteId: connection?.externalAthleteId ?? null,
    expiresAt: connection?.expiresAt ?? null,
  });
}

export async function DELETE(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);

  await deleteStravaConnection(profile.userId);
  return jsonOk({ disconnected: true });
}
