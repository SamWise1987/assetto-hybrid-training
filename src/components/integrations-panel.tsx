"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Activity, CloudDownload, HeartPulse, Link2, Smartphone, Unlink, Upload, Watch } from "lucide-react";
import { db, importExternalRun } from "@/lib/db";
import { gpxToRunSession, parseGpx } from "@/lib/gpx-import";
import { summarizeHealthVitals } from "@/lib/health-vitals";
import {
  getNativeHealthAvailability,
  importNativeWorkouts,
  isNativeShell,
  recordNativeHealthFailure,
  type NativeHealthAvailability,
} from "@/lib/native-health";
import { getRemoteAccessToken, pullExternalWorkoutsFromCloud, pullHealthMetricsFromCloud } from "@/lib/remote-sync";
import { stravaActivityToRunSession, type StravaActivity } from "@/lib/strava";
import { useAppStore } from "@/lib/store";
import { Button, Surface } from "./ui";

export function IntegrationsPanel({ onStatus }: { onStatus: (message: string) => void }) {
  const gpxRef = useRef<HTMLInputElement>(null);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaConfigured, setStravaConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<NativeHealthAvailability | null>(null);
  const integrationMessage = useAppStore((state) => state.integrationMessage);
  const report = useCallback((message: string) => onStatus(message), [onStatus]);
  const healthState = useLiveQuery(() => db.healthSyncStates.toCollection().first());
  const healthMetrics = useLiveQuery(() => db.healthMetrics.orderBy("recordedAt").reverse().limit(40).toArray(), [], []);
  const vitals = summarizeHealthVitals(healthMetrics);

  useEffect(() => {
    if (integrationMessage) report(integrationMessage);
  }, [integrationMessage, report]);

  useEffect(() => {
    getNativeHealthAvailability().then(setHealth).catch(() => undefined);
  }, []);

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

  const importFromWatch = async () => {
    setBusy(true);
    try {
      const result = await importNativeWorkouts(30);
      report(
        result.imported || result.importedMetrics
          ? `${result.imported} attività e ${result.importedMetrics} segnali salute da ${health?.platform === "ios" ? "Apple Salute" : "Health Connect"} sincronizzati anche sul cloud (webapp).`
          : "Nessuna nuova attività o segnale salute da importare.",
      );
    } catch (error) {
      await recordNativeHealthFailure(error);
      report(error instanceof Error ? error.message : "Import nativo fallito.");
    } finally {
      setBusy(false);
    }
  };

  const refreshFromCloud = async () => {
    setBusy(true);
    try {
      const [workouts, metrics] = await Promise.all([
        pullExternalWorkoutsFromCloud(),
        pullHealthMetricsFromCloud(),
      ]);
      report(
        workouts.length || metrics.length
          ? `Aggiornato dal cloud: ${workouts.length} attività e ${metrics.length} segnali salute (FC, respiro, SpO₂, passi, sonno).`
          : "Nessun dato Health sul cloud. Collega Apple Salute dall’app iPhone e sincronizza una volta.",
      );
    } catch (error) {
      report(error instanceof Error ? error.message : "Aggiornamento cloud non riuscito.");
    } finally {
      setBusy(false);
    }
  };

  const connectStrava = async () => {
    const token = await getRemoteAccessToken();
    if (!token) {
      report("Accedi con il tuo account prima di collegare Strava.");
      return;
    }
    const response = await fetch("/api/strava/auth", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      report("Strava non disponibile sul server.");
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
    report("Strava scollegato.");
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
      report(imported ? `${imported} attività Strava importate.` : "Nessuna nuova attività Strava.");
    } catch (error) {
      report(error instanceof Error ? error.message : "Import Strava fallito.");
    } finally {
      setBusy(false);
    }
  };

  const importGpx = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const xml = await file.text();
      const parsed = parseGpx(xml);
      if (!parsed) throw new Error("File GPX non valido o senza traccia.");
      const run = gpxToRunSession(parsed);
      const result = await importExternalRun(run);
      report(result.imported ? "File GPX importato." : "Questa attività GPX era già presente.");
    } catch (error) {
      report(error instanceof Error ? error.message : "Import GPX fallito.");
    } finally {
      setBusy(false);
    }
  };

  const nativeReady = Boolean(health?.available && isNativeShell());
  const onWeb = !isNativeShell();
  const lastSyncLabel = healthState?.lastSuccessfulSyncAt
    ? new Date(healthState.lastSuccessfulSyncAt).toLocaleString("it-IT")
    : null;

  return (
    <Surface>
      <div className="surface-heading">
        <div>
          <p className="date-label">Integrazioni</p>
          <h2>Apple Salute e dispositivi</h2>
        </div>
        <Watch />
      </div>

      <div className="integration-card health-bridge-card">
        <strong><HeartPulse size={18} aria-hidden="true" /> Ponte Apple Watch → webapp</strong>
        <ol className="health-bridge-steps">
          <li>Apple Watch (o Garmin/Huawei) scrive in <em>Apple Salute</em> / Health Connect</li>
          <li>L’app <em>iPhone</em> RobertaFunctional autorizza e legge i dati</li>
          <li>I segnali salgono sul cloud e appaiono anche sulla <em>webapp</em></li>
        </ol>
        <p>
          Dati letti: allenamenti (corsa, camminata, forza), frequenza cardiaca in attività,
          FC a riposo, HRV, frequenza respiratoria, SpO₂, passi e sonno.
        </p>
        {lastSyncLabel ? (
          <p className="quiet-note">Ultimo sync nativo: {lastSyncLabel}{healthState?.platform ? ` · ${healthState.platform}` : ""}</p>
        ) : (
          <p className="quiet-note">Nessun sync Health ancora. Collega Salute dall’app iPhone.</p>
        )}
        {vitals.length ? (
          <div className="health-vitals-grid compact">
            {vitals.slice(0, 4).map((item) => (
              <article key={item.key}>
                <span>{item.label}</span>
                <strong>{item.display}</strong>
              </article>
            ))}
          </div>
        ) : null}
        {nativeReady ? (
          <Button onClick={importFromWatch} disabled={busy}>
            <Watch /> {busy ? "Sincronizzazione…" : "Sincronizza Apple Salute ora"}
          </Button>
        ) : (
          <div className="settings-actions">
            <Button onClick={refreshFromCloud} disabled={busy}>
              <CloudDownload /> {busy ? "Aggiornamento…" : "Aggiorna segnali dal cloud"}
            </Button>
            <p className="quiet-note">
              {onWeb
                ? "Dal browser non si può aprire HealthKit: usa l’app iOS una volta, poi qui vedi gli stessi dati."
                : health?.reason ?? "Salute nativa non disponibile su questo dispositivo."}
            </p>
            {onWeb ? (
              <p className="quiet-note"><Smartphone /> Build iOS: vedi CAPACITOR.md</p>
            ) : null}
          </div>
        )}
      </div>

      <div className="integration-card">
        <strong>File GPX</strong>
        <p>Fallback universale: esporti da Apple Salute, Garmin Connect, Huawei Health, e importi qui.</p>
        <input ref={gpxRef} className="visually-hidden" type="file" accept=".gpx,application/gpx+xml" onChange={(event) => importGpx(event.target.files?.[0])} />
        <Button variant="secondary" onClick={() => gpxRef.current?.click()} disabled={busy}>
          <Upload /> Importa GPX
        </Button>
      </div>

      <div className="integration-card muted">
        <strong>Strava (opzionale)</strong>
        <p>
          Non richiesto. Utile solo se hai già un account Strava. La strada ufficiale è Apple Salute / Health Connect.
        </p>
        {stravaConfigured ? (
          stravaConnected ? (
            <div className="settings-actions">
              <Button variant="secondary" onClick={importStrava} disabled={busy}>
                <Link2 /> {busy ? "Import in corso…" : "Importa da Strava"}
              </Button>
              <Button variant="ghost" onClick={disconnectStrava}>
                <Unlink /> Scollega
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={connectStrava}><Link2 /> Collega Strava (opzionale)</Button>
          )
        ) : (
          <p className="quiet-note">Strava non configurato — ok, non serve per la produzione nativa.</p>
        )}
      </div>

      <div className="integration-card muted">
        <strong>Come collegare i dispositivi</strong>
        <ul className="integration-list">
          <li><Activity /> Apple Watch → Apple Salute (automatico) → app iOS RobertaFunctional</li>
          <li>Garmin → Garmin Connect → sincronizza con Apple Salute / Health Connect</li>
          <li>Huawei → Huawei Health → Health Connect (Android) o export GPX</li>
        </ul>
      </div>
    </Surface>
  );
}
