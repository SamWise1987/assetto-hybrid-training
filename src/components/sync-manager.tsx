"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { registerOnlineSync, retryFailedSync } from "@/lib/normalized-sync";

export function SyncManager() {
  const pending = useLiveQuery(() => db.syncQueue.count()) ?? 0;
  const failed = useLiveQuery(() => db.syncQueue.filter((item) => item.attemptCount > 0).count()) ?? 0;
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const unregisterSync = registerOnlineSync();
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      unregisterSync();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  if (online && !pending) return null;
  return <div className={`sync-banner ${failed ? "has-error" : ""}`} role="status">
    <span>{!online ? `Modalità offline · ${pending} modifica${pending === 1 ? "" : "he"} salvata${pending === 1 ? "" : "e"} sul dispositivo` : failed ? `${failed} modifica${failed === 1 ? " non sincronizzata" : "he non sincronizzate"}. I dati locali sono al sicuro.` : `${pending} modifica${pending === 1 ? "" : "he"} in sincronizzazione`}</span>
    {online && failed ? <button type="button" onClick={() => retryFailedSync().catch(() => undefined)}>Riprova</button> : null}
  </div>;
}
