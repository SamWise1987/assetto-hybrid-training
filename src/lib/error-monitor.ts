"use client";

import { currentPlatform } from "./platform";
import { getRemoteAccessToken } from "./remote-sync";
import { sanitizeErrorContext, sanitizeErrorMessage } from "./error-sanitizer";

export type ErrorSubsystem = "api" | "sync" | "health" | "notifications" | "ui" | "pwa";
const recent = new Map<string, number>();

export async function reportAppError(subsystem: ErrorSubsystem, error: unknown, context: Record<string, unknown> = {}, severity: "warning" | "error" | "fatal" = "error") {
  const message = sanitizeErrorMessage(error instanceof Error ? error.message : error, subsystem);
  const signature = `${subsystem}:${message}`;
  const now = Date.now();
  if (now - (recent.get(signature) ?? 0) < 60_000) return;
  recent.set(signature, now);
  const token = await getRemoteAccessToken(); if (!token) return;
  await fetch("/api/monitoring/errors", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ subsystem, severity, message, context: sanitizeErrorContext(context), platform: currentPlatform() }),
    keepalive: true,
  }).catch(() => undefined);
}
