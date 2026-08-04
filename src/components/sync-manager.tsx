"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { registerOnlineSync, retryFailedSync } from "@/lib/normalized-sync";
import { syncBannerState } from "@/lib/sync-status";
import { isSyncItemAllowedForRole } from "@/lib/sync-scope";

export function SyncManager() {
  const role = useLiveQuery(
    () => db.accountProfiles.get("account-profile").then((account) => account?.role),
    [],
    null,
  );
  const pending = useLiveQuery(
    () => role === null ? 0 : db.syncQueue.filter((item) => isSyncItemAllowedForRole(item, role)).count(),
    [role],
  ) ?? 0;
  const failed = useLiveQuery(
    () => role === null ? 0 : db.syncQueue.filter((item) => item.attemptCount > 0 && isSyncItemAllowedForRole(item, role)).count(),
    [role],
  ) ?? 0;
  const conflicts = useLiveQuery(
    () => role === null ? 0 : db.syncQueue.filter((item) => item.lastError?.startsWith("Conflitto:") === true && isSyncItemAllowedForRole(item, role)).count(),
    [role],
  ) ?? 0;
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
  if (role === null || (online && !pending)) return null;
  const banner = syncBannerState({ online, pending, failed, conflicts });
  return <div className={`sync-banner ${banner.tone === "error" ? "has-error" : ""}`} role={banner.tone === "error" ? "alert" : "status"}>
    <span>{banner.message}</span>
    {banner.actionLabel ? <button type="button" onClick={() => retryFailedSync().catch(() => undefined)}>{banner.actionLabel}</button> : null}
  </div>;
}
