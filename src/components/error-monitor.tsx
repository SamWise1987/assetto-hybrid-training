"use client";

import { useEffect } from "react";
import { reportAppError } from "@/lib/error-monitor";

export function ErrorMonitor() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => { reportAppError("ui", event.error ?? event.message, { filename: event.filename, line: event.lineno }, "fatal").catch(() => undefined); };
    const onRejection = (event: PromiseRejectionEvent) => { reportAppError("ui", event.reason, { kind: "unhandledrejection" }, "fatal").catch(() => undefined); };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  return null;
}
