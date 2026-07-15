"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Link2, Smartphone, Unlink, Upload, Watch } from "lucide-react";
import { importExternalRun } from "@/lib/db";
import { gpxToRunSession, parseGpx } from "@/lib/gpx-import";
import {
  getNativeHealthAvailability,
  importNativeWorkouts,
  isNativeShell,
  recordNativeHealthFailure,
  type NativeHealthAvailability,
} from "@/lib/native-health";
import { getRemoteAccessToken } from "@/lib/remote-sync";
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
        result.imported
          ? `${result.imported} attività importate da ${health?.platform === "ios" ? "Apple Health" : "Health Connect"}: ${result.importedRuns} corsa/camminata e ${result.importedStrength} forza${result.skipped ? ` (${result.skipped} già presenti)` : ""}.`
          : "Nessuna nuova attività di corsa, camminata o forza da importare.",
      );
    } catch (error) {
      await recordNativeHealthFailure(error);
      report(error instanceof Error ? error.message : "Import nativo fallito.");
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
      report(imported ? `${imported} corse importate da Strava.` : "Nessuna nuova corsa da importare.");
    } catch (error) {
      report(error instanceof Error ? error.message : "Import fallito.");
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
      report(
        result.imported
          ? `Corsa importata: ${parsed.distanceKm} km in ${parsed.durationMinutes} min.`
          : "Questa corsa era già presente.",
      );
    } catch (error) {
      report(error instanceof Error ? error.message : "Import GPX fallito.");
    } finally {
      setBusy(false);
    }
  };

  const nativeReady = Boolean(health?.available);
  const onWeb = !isNativeShell();

  return (
    <Surface>
      <div className="surface-heading">
        <div>
          <p className="date-label">Integrazioni</p>
          <h2>Corsa da orologio e dispositivi</h2>
        </div>
        <Watch />
      </div>
      <p>
        Percorso principale: app nativa Capacitor che legge Apple Health (iPhone/Apple Watch)
        e Health Connect (Android / Garmin / Huawei quando sincronizzati). Niente subscription Strava.
      </p>

      <div className="integration-card">
        <strong>Apple Health / Health Connect</strong>
        <p>
          Importa allenamenti di corsa, camminata e forza dagli ultimi 30 giorni. Funziona con Apple Watch,
          e con Garmin / Huawei se l&apos;utente abilita la sincronizzazione verso Apple Salute o Health Connect.
        </p>
        {nativeReady ? (
          <Button onClick={importFromWatch} disabled={busy}>
            <Watch /> {busy ? "Import in corso…" : "Importa da orologio"}
          </Button>
        ) : (
          <>
            <p className="quiet-note">
              {onWeb
                ? "Apri l'app nativa iOS/Android (Capacitor) per collegare HealthKit / Health Connect. Sul browser resta disponibile l'import GPX."
                : health?.reason ?? "Salute nativa non disponibile su questo dispositivo."}
            </p>
            {onWeb ? (
              <p className="quiet-note"><Smartphone /> Build: vedi CAPACITOR.md — `npx cap open ios|android`.</p>
            ) : null}
          </>
        )}
      </div>

      <div className="integration-card">
        <strong>File GPX</strong>
        <p>Fallback universale: esporti da Apple Health, Garmin Connect, Huawei Health, e importi qui.</p>
        <input ref={gpxRef} className="visually-hidden" type="file" accept=".gpx,application/gpx+xml" onChange={(event) => importGpx(event.target.files?.[0])} />
        <Button variant="secondary" onClick={() => gpxRef.current?.click()} disabled={busy}>
          <Upload /> Importa GPX
        </Button>
      </div>

      <div className="integration-card muted">
        <strong>Strava (opzionale)</strong>
        <p>
          Non richiesto. Utile solo se hai già un account Strava free/paid e preferisci quel ponte.
          La strada ufficiale per RobertaFunctional è Capacitor + salute nativa.
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
          <li><Activity /> Apple Watch → Apple Salute (automatico)</li>
          <li>Garmin → Garmin Connect → sincronizza con Apple Salute / Health Connect</li>
          <li>Huawei → Huawei Health → Health Connect (Android) o export GPX</li>
        </ul>
      </div>
    </Surface>
  );
}
