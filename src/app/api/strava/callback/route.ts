import { NextResponse } from "next/server";
import { saveStravaConnection, exchangeStravaCode, stravaConfigured } from "@/lib/strava-server";

export async function GET(request: Request) {
  if (!stravaConfigured()) {
    return NextResponse.redirect(new URL("/?integrations=strava-unavailable", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const stateRaw = searchParams.get("state");

  if (error || !code || !stateRaw) {
    return NextResponse.redirect(new URL("/?integrations=strava-denied", request.url));
  }

  try {
    const state = JSON.parse(Buffer.from(stateRaw, "base64url").toString()) as { userId: string };
    const tokens = await exchangeStravaCode(code);
    await saveStravaConnection(state.userId, tokens);
    return NextResponse.redirect(new URL("/?integrations=strava-connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/?integrations=strava-error", request.url));
  }
}
