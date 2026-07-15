"use client";

import { useEffect, useRef, useState } from "react";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const refreshRequested = useRef(false);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      let registration: ServiceWorkerRegistration | undefined;
      let observedRegistration: ServiceWorkerRegistration | undefined;
      let disposed = false;
      const watchedWorkers = new WeakSet<ServiceWorker>();
      const watchWorker = (worker: ServiceWorker | null) => {
        if (!worker || watchedWorkers.has(worker)) return;
        watchedWorkers.add(worker);
        worker?.addEventListener("statechange", () => {
          if (!disposed && worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker);
        });
      };
      const onUpdateFound = () => { watchWorker(observedRegistration?.installing ?? null); };
      const observeRegistration = (nextRegistration: ServiceWorkerRegistration) => {
        registration = nextRegistration;
        if (observedRegistration !== nextRegistration) {
          observedRegistration?.removeEventListener("updatefound", onUpdateFound);
          observedRegistration = nextRegistration;
          observedRegistration.addEventListener("updatefound", onUpdateFound);
        }
        if (nextRegistration.waiting) setWaiting(nextRegistration.waiting);
        watchWorker(nextRegistration.installing);
      };
      navigator.serviceWorker.register("/sw.js").then((registered) => {
        if (disposed) return;
        observeRegistration(registered);
      }).catch(() => undefined);
      navigator.serviceWorker.ready.then((readyRegistration) => {
        if (disposed) return;
        observeRegistration(readyRegistration);
        readyRegistration.update().catch(() => undefined);
      }).catch(() => undefined);
      const checkForUpdate = () => { registration?.update().catch(() => undefined); };
      const onVisible = () => { if (document.visibilityState === "visible") checkForUpdate(); };
      window.addEventListener("online", checkForUpdate);
      document.addEventListener("visibilitychange", onVisible);
      const interval = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      const onControllerChange = () => { if (refreshRequested.current) window.location.reload(); };
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      return () => {
        disposed = true;
        observedRegistration?.removeEventListener("updatefound", onUpdateFound);
        window.clearInterval(interval);
        window.removeEventListener("online", checkForUpdate);
        document.removeEventListener("visibilitychange", onVisible);
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      };
    }
  }, []);
  if (!waiting) return null;
  return <div className="pwa-update-banner" role="status"><span>È disponibile una nuova versione dell’app.</span><button type="button" onClick={() => { refreshRequested.current = true; waiting.postMessage({ type: "SKIP_WAITING" }); }}>Aggiorna ora</button></div>;
}
