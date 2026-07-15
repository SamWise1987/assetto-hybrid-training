"use client";

import { useEffect, useRef, useState } from "react";

export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const refreshRequested = useRef(false);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        if (registration.waiting) setWaiting(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker);
          });
        });
        registration.update().catch(() => undefined);
      }).catch(() => undefined);
      const onControllerChange = () => { if (refreshRequested.current) window.location.reload(); };
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    }
  }, []);
  if (!waiting) return null;
  return <div className="pwa-update-banner" role="status"><span>È disponibile una nuova versione dell’app.</span><button type="button" onClick={() => { refreshRequested.current = true; waiting.postMessage({ type: "SKIP_WAITING" }); }}>Aggiorna ora</button></div>;
}
