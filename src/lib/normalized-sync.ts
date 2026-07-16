"use client";

import { db } from "./db";
import { getRemoteAccessToken, syncAccountProfile } from "./remote-sync";
import type { DailyReadiness, NextDayResponse, RunSession, WorkoutSession } from "./types";
import { reportAppError } from "./error-monitor";

let flushing = false;

function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export async function flushSyncQueue() {
  if (flushing || !isOnline()) return 0;
  flushing = true;
  try {
    const token = await getRemoteAccessToken();
    if (!token) return 0;
    let synced = 0;
    while (isOnline()) {
      const items = (await db.syncQueue.where("attemptCount").equals(0).sortBy("createdAt")).slice(0, 100);
      if (!items.length) return synced;
      const send = (batch: typeof items) => fetch("/api/sync/normalized", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: batch.map(({ entity, entityId, payload }) => ({ entity, entityId, payload })) }),
      });
      const response = await send(items);
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Sync server non riuscita" })) as { error?: string };
        const message = response.status === 409 ? `Conflitto: ${body.error ?? "dati aggiornati su un altro dispositivo"}` : body.error ?? "Sync server non riuscita";

        if (items.length > 1 && [400, 409, 422].includes(response.status)) {
          for (const item of items) {
            const itemResponse = await send([item]);
            if (itemResponse.ok) {
              await db.syncQueue.delete(item.id);
              synced += 1;
              continue;
            }
            const itemBody = await itemResponse.json().catch(() => ({ error: "Sync elemento non riuscita" })) as { error?: string };
            const itemMessage = itemResponse.status === 409
              ? `Conflitto: ${itemBody.error ?? "dati aggiornati su un altro dispositivo"}`
              : itemBody.error ?? "Sync elemento non riuscita";
            if (itemResponse.status === 409 && item.entity === "profile") {
              await db.syncQueue.delete(item.id);
              await syncAccountProfile().catch(() => undefined);
            } else {
              await db.syncQueue.put({ ...item, attemptCount: item.attemptCount + 1, lastError: itemMessage });
            }
            reportAppError("sync", itemMessage, { status: itemResponse.status, itemCount: 1, operation: item.entity }).catch(() => undefined);
          }
        } else if (response.status === 409) {
          const profileItems = items.filter((item) => item.entity === "profile");
          if (profileItems.length) await db.syncQueue.bulkDelete(profileItems.map((item) => item.id));
          if (profileItems.length) await syncAccountProfile().catch(() => undefined);
          await Promise.all(items.filter((item) => item.entity !== "profile").map((item) => db.syncQueue.put({ ...item, attemptCount: item.attemptCount + 1, lastError: message })));
        } else {
          await Promise.all(items.map((item) => db.syncQueue.put({ ...item, attemptCount: item.attemptCount + 1, lastError: message })));
        }
        reportAppError("sync", message, { status: response.status, itemCount: items.length }).catch(() => undefined);
        continue;
      }
      await db.syncQueue.bulkDelete(items.map((item) => item.id));
      synced += items.length;
    }
    return synced;
  } finally { flushing = false; }
}

export function registerOnlineSync() {
  const handler = () => { flushSyncQueue().catch(() => undefined); };
  window.addEventListener("online", handler);
  handler();
  return () => window.removeEventListener("online", handler);
}

export async function retryFailedSync() {
  const failed = await db.syncQueue.filter((item) => item.attemptCount > 0).toArray();
  await Promise.all(failed.map((item) => db.syncQueue.put({ ...item, attemptCount: 0, lastError: undefined })));
  return flushSyncQueue();
}

export async function pullNormalizedHistory() {
  const token = await getRemoteAccessToken();
  if (!token) return 0;
  const response = await fetch("/api/sync/normalized", { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return 0;
  const body = await response.json() as {
    workouts: Array<{ payload: WorkoutSession }>;
    runs: Array<{ payload: RunSession }>;
    readiness: Array<{ payload: DailyReadiness }>;
    followUps: Array<{ payload: NextDayResponse }>;
  };
  const workouts = body.workouts.map((item) => item.payload).filter((item) => item?.id);
  const runs = body.runs.map((item) => item.payload).filter((item) => item?.id);
  const readiness = body.readiness.map((item) => item.payload).filter((item) => item?.id);
  const followUps = body.followUps.map((item) => item.payload).filter((item) => item?.id);
  if (workouts.length) await db.workoutSessions.bulkPut(workouts);
  if (runs.length) await db.runs.bulkPut(runs);
  if (readiness.length) await db.readiness.bulkPut(readiness);
  if (followUps.length) await db.nextDayResponses.bulkPut(followUps);
  return workouts.length + runs.length + readiness.length + followUps.length;
}
