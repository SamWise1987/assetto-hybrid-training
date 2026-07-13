"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Link2, Unlink, Upload } from "lucide-react";
import { importExternalRun } from "@/lib/db";
import { gpxToRunSession, parseGpx } from "@/lib/gpx-import";
import { getRemoteAccessToken } from "@/lib/remote-sync";
import { stravaActivityToRunSession, type StravaActivity } from "@/lib/strava";
import { useAppStore } from "@/lib/store";
import { Button, Surface } from "./ui";

export function IntegrationsPanel({ onStatus }: { onStatus: (message: string) => void }) {
  const gpxRef = useRef<HTMLInputElement>(null);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaConfigured, setStravaConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const integrationMessage = useAppStore((state) => state.integrationMessage);

  useEffect(() => {
    if (integrationMessage) onStatus(integrationMessage);
  }, [integrationMessage, onStatus]);

  useEffect(() => {
    getRemoteAccessToken()
      .then(async (token) => {
        if (!token) return;
        const response = await fetch("/api/strava/status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const body = (await response.json()) as { configured: boolean; connected: boolean };
        setStravaConfigured(body.configured);
        setStravaConnected(body.connected);
      })
      .catch(() => undefined);
  }, []);

  const connectStrava = async () => {
    const token = await getRemoteAccessToken();
    if (!token) {
      onStatus("Accedi con il tuo account prima di collegare Strava.");
      return;
    }
    const response = await fetch("/api/strava/auth", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      onStatus("Strava non disponibile sul server.");
      return;
    }
    const body = (await response.json()) as { url: string };
    window.location.href = body.url;
  };

  const disconnectStrava = async () => {
    const token = await getRemoteAccessToken();
    if (!token) return;
    await fetch("/api/strava/status", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setStravaConnected(false);
    onStatus("Strava scollegato.");
  };

  const importStrava = async () => {
    setBusy(true);
    try {
      const token = await getRemoteAccessToken();
      if (!token) throw new Error("Accesso richiesto.");
      const response = await fetch("/api/strava/activities?afterDays=30", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Import Strava non riuscito.");
      const body = (await response.json()) as { activities: StravaActivity[] };
      let imported = 0;
      for (const activity of body.activities) {
        const run = stravaActivityToRunSession(activity);
        if (!run) continue;
        const result = await importExternalRun(run);
        if (result.imported) imported += 1;
      }
      onStatus(imported ? `${imported} corse importate da Strava.` : "Nessuna nuova corsa da importare.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Import fallito.");
    } finally {
      setBusy(false);
    }
  };

  const importGpx = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const parsed = parseGpx(await file.text());
      if (!parsed) throw new Error("File GPX non valido.");
      const run = gpxToRunSession(parsed);
      const result = await importExternalRun(run);
      onStatus(
        result.imported
          ? `Corsa importata: ${parsed.distanceKm} km in ${parsed.durationMinutes} min.`
          : "Questa corsa era già presente.",
      );
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Import GPX fallito.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Surface>
      <div className="surface-heading">
        <div>
          <p className="date-label">Integrazioni</p>
          <h2>Corsa da app e dispositivi</h2>
        </div>
        <Activity />
      </div>
      <p>
        Collega Strava per importare automaticamente le corse registrate su Apple Watch, Garmin o altre app.
        Su iOS e Android funziona dal browser installato come app (PWA).
      </p>

      <div className="integration-card">
        <strong>Strava</strong>
        <p>Sincronizza le corse degli ultimi 30 giorni. Compatibile con Runna, Nike Run Club e la maggior parte dei tracker.</p>
        {stravaConfigured ? (
          stravaConnected ? (
            <div className="settings-actions">
              <Button variant="secondary" onClick={importStrava} disabled={busy}>
                <Link2 /> {busy ? "Import in corso…" : "Importa corse"}
              </Button>
              <Button variant="ghost" onClick={disconnectStrava}>
                <Unlink /> Scollega
              </Button>
            </div>
          ) : (
            <Button onClick={connectStrava}><Link2 /> Collega Strava</Button>
          )
        ) : (
          <p className="quiet-note">Strava non configurato sul server (variabili STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET).</p>
        )}
      </div>

      <div className="integration-card">
        <strong>File GPX</strong>
        <p>Importa un tracciato esportato da Apple Health, Garmin Connect o altre app.</p>
        <input ref={gpxRef} className="visually-hidden" type="file" accept=".gpx,application/gpx+xml" onChange={(event) => importGpx(event.target.files?.[0])} />
        <Button variant="secondary" onClick={() => gpxRef.current?.click()} disabled={busy}>
          <Upload /> Importa GPX
        </Button>
      </div>

      <div className="integration-card muted">
        <strong>Apple Health e Health Connect</strong>
        <p>
          L&apos;accesso diretto richiede l&apos;app nativa (HealthKit / Health Connect).
          Per ora usa Strava come ponte o importa GPX. Un wrapper Capacitor è previsto nella roadmap.
        </p>
      </div>
    </Surface>
  );
}
