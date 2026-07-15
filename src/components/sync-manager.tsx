"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { registerOnlineSync, retryFailedSync } from "@/lib/normalized-sync";
import { syncBannerState } from "@/lib/sync-status";

export function SyncManager() {
  const pending = useLiveQuery(() => db.syncQueue.count()) ?? 0;
  const failed = useLiveQuery(() => db.syncQueue.filter((item) => item.attemptCount > 0).count()) ?? 0;
  const conflicts = useLiveQuery(() => db.syncQueue.filter((item) => item.lastError?.startsWith("Conflitto:") === true).count()) ?? 0;
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
  const banner = syncBannerState({ online, pending, failed, conflicts });
  return <div className={`sync-banner ${banner.tone === "error" ? "has-error" : ""}`} role={banner.tone === "error" ? "alert" : "status"}>
    <span>{banner.message}</span>
    {banner.actionLabel ? <button type="button" onClick={() => retryFailedSync().catch(() => undefined)}>{banner.actionLabel}</button> : null}
  </div>;
}
