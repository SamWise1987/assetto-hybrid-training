import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { getRemoteUserProfile, staffClient } from "@/lib/supabase/profiles";
import type { Database } from "@/lib/supabase/client";
import { sanitizeErrorContext, sanitizeErrorMessage } from "@/lib/error-sanitizer";

const schema = z.object({
  subsystem: z.enum(["api", "sync", "health", "notifications", "ui", "pwa"]),
  severity: z.enum(["warning", "error", "fatal"]).default("error"),
  message: z.string().min(1).max(1000),
  context: z.record(z.string(), z.unknown()).default({}),
  platform: z.enum(["web", "ios", "android"]).default("web"),
});

export async function POST(request: Request) {
  const profile = await getRemoteUserProfile(request);
  if (!profile) return jsonError("Autenticazione richiesta.", 401);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Evento errore non valido.");
  const client = staffClient(request); if (!client) return jsonError("Supabase non configurato.", 503);
  const { error } = await client.from("app_error_events").insert({
    user_id: profile.userId,
    subsystem: parsed.data.subsystem,
    severity: parsed.data.severity,
    message: sanitizeErrorMessage(parsed.data.message, parsed.data.subsystem),
    context: sanitizeErrorContext(parsed.data.context) as Database["public"]["Tables"]["app_error_events"]["Insert"]["context"],
    platform: parsed.data.platform,
    app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0",
  });
  if (error) return jsonError(error.message, 500);
  return jsonOk({ recorded: true });
}
