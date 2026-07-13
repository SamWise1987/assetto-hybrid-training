"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Brain, Cloud, Database, Download, LockKeyhole, RotateCcw, Shield, Sparkles, Trash2, Upload } from "lucide-react";
import {
  buildTrainingSnapshot,
  deterministicCoachReview,
  loadLocalAiSettings,
  saveLocalAiSettings,
} from "@/lib/ai-coach";
import { clearDatabase, db, exportDatabase, exportHistoryCsv, getActiveBlockWeek, importDatabase, seedDemoData } from "@/lib/db";
import {
  cloudSyncAvailable,
  getRemoteUserEmail,
  pullSnapshotFromCloud,
  pushSnapshotToCloud,
  signInWithEmail,
  signOutRemote,
} from "@/lib/remote-sync";
import { TEMPLATES } from "@/lib/program";
import { OpenAICoachAdapter } from "@/lib/sync-adapter";
import { Button, Field, Surface, Toggle } from "../ui";

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SettingsScreen() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [deleteStep, setDeleteStep] = useState(0);
  const [coachBusy, setCoachBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [remoteEmail, setRemoteEmail] = useState<string | null>(null);
  const [aiSettings, setAiSettings] = useState(loadLocalAiSettings);
  const latestReview = useLiveQuery(() => db.coachReviews.orderBy("date").last());
  const blockWeek = useLiveQuery(() => getActiveBlockWeek(), [], 4);
  const syncEnabled = cloudSyncAvailable();

  useEffect(() => {
    getRemoteUserEmail().then(setRemoteEmail).catch(() => setRemoteEmail(null));
  }, [status]);

  const exportJson = async () => {
    download(`assetto-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await exportDatabase(), null, 2), "application/json");
    setStatus("Backup JSON esportato.");
  };

  const exportCsv = async () => {
    download("assetto-storico.csv", await exportHistoryCsv(), "text/csv");
    setStatus("Storico CSV esportato.");
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      await importDatabase(JSON.parse(await file.text()));
      setStatus("Backup importato.");
    } catch {
      setStatus("Import non riuscito: file non valido.");
    }
  };

  const deleteAll = async () => {
    if (deleteStep < 2) {
      setDeleteStep(deleteStep + 1);
      return;
    }
    await clearDatabase();
    setStatus("Tutti i dati sono stati cancellati.");
  };

  const persistAiSettings = (next: typeof aiSettings) => {
    setAiSettings(next);
    saveLocalAiSettings(next);
  };

  const runCoachReview = async () => {
    setCoachBusy(true);
    try {
      const [workouts, runs, progressionDecisions, runCalibrations] = await Promise.all([
        db.workoutSessions.toArray(),
        db.runs.toArray(),
        db.progressionDecisions.toArray(),
        db.runCalibrationDecisions.toArray(),
      ]);
      const templateNames = Object.fromEntries(TEMPLATES.map((template) => [template.id, template.name]));
      const snapshot = buildTrainingSnapshot({
        week: blockWeek,
        workouts,
        runs,
        progressionDecisions,
        runCalibrations,
        templateNames,
      });

      let review = deterministicCoachReview(snapshot);
      let source: "openai" | "deterministic" = "deterministic";

      if (aiSettings.enabled && aiSettings.apiKey) {
        const adapter = new OpenAICoachAdapter();
        const response = (await adapter.review(snapshot, aiSettings.apiKey)) as {
          review: typeof review;
          fallback?: boolean;
        };
        review = response.review;
        source = response.fallback ? "deterministic" : "openai";
      }

      await db.coachReviews.put({ ...review, source });
      await db.appSettings.put({
        id: "app-settings",
        aiCoachEnabled: aiSettings.enabled,
        aiModel: aiSettings.model,
        lastCoachReviewAt: new Date().toISOString(),
      });
      setStatus(source === "openai" ? "Analisi AI completata." : "Analisi locale completata.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Coach non disponibile.");
    } finally {
      setCoachBusy(false);
    }
  };

  const sendMagicLink = async () => {
    if (!email.includes("@")) {
      setStatus("Inserisci un'email valida.");
      return;
    }
    try {
      await signInWithEmail(email);
      setStatus("Link di accesso inviato. Controlla la posta e torna qui.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Accesso non riuscito.");
    }
  };

  const pushCloud = async () => {
    setSyncBusy(true);
    try {
      const payload = await exportDatabase();
      await pushSnapshotToCloud(payload, true);
      setStatus("Backup sincronizzato su Supabase.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sync push fallita.");
    } finally {
      setSyncBusy(false);
    }
  };

  const pullCloud = async () => {
    setSyncBusy(true);
    try {
      const payload = await pullSnapshotFromCloud();
      if (!payload) {
        setStatus("Nessun backup remoto trovato.");
        return;
      }
      await importDatabase(payload);
      setStatus("Backup remoto ripristinato sul dispositivo.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sync pull fallita.");
    } finally {
      setSyncBusy(false);
    }
  };

  return (
    <div className="screen-stack">
      <header className="section-heading">
        <p className="date-label">Controllo locale</p>
        <h1>Impostazioni</h1>
        <p>Local-first di default. Cloud e AI sono opt-in.</p>
      </header>

      <Surface className="privacy-panel">
        <LockKeyhole />
        <div>
          <h2>I dati restano sul dispositivo</h2>
          <p>IndexedDB locale. La sincronizzazione Supabase parte solo dopo login e consenso esplicito.</p>
        </div>
      </Surface>

      {syncEnabled ? (
        <Surface>
          <div className="surface-heading">
            <div><p className="date-label">Backend cloud</p><h2>Supabase sync</h2></div>
            <Cloud />
          </div>
          {remoteEmail ? <p>Connesso come <strong>{remoteEmail}</strong></p> : null}
          <Field
            label="Email per magic link"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="settings-actions">
            <Button variant="secondary" onClick={sendMagicLink}>Invia link di accesso</Button>
            <Button onClick={pushCloud} disabled={syncBusy}>Carica backup cloud</Button>
            <Button variant="secondary" onClick={pullCloud} disabled={syncBusy}>Scarica backup cloud</Button>
            {remoteEmail ? (
              <Button variant="ghost" onClick={async () => { await signOutRemote(); setRemoteEmail(null); setStatus("Disconnesso."); }}>
                Esci
              </Button>
            ) : null}
          </div>
        </Surface>
      ) : (
        <Surface>
          <p>Supabase non configurato. Imposta le variabili in <code>.env.local</code> e su Vercel.</p>
        </Surface>
      )}

      <Surface>
        <div className="surface-heading">
          <div><p className="date-label">Coach intelligente</p><h2>OpenAI (opzionale)</h2></div>
          <Brain />
        </div>
        <Toggle
          label="Abilita revisione AI settimanale"
          checked={aiSettings.enabled}
          onChange={(enabled) => persistAiSettings({ ...aiSettings, enabled })}
        />
        <Field
          label="Chiave API OpenAI (solo su questo dispositivo)"
          type="password"
          autoComplete="off"
          value={aiSettings.apiKey ?? ""}
          onChange={(e) => persistAiSettings({ ...aiSettings, apiKey: e.target.value })}
        />
        <Button onClick={runCoachReview} disabled={coachBusy}>
          <Sparkles /> {coachBusy ? "Analizzo la settimana…" : "Analisi settimanale"}
        </Button>
        {latestReview ? (
          <aside className="rule-preview">
            <strong>{latestReview.summary}</strong>
            {latestReview.nextWeekFocus.map((item) => <p key={item}>{item}</p>)}
          </aside>
        ) : null}
      </Surface>

      <Surface>
        <div className="surface-heading">
          <div><p className="date-label">Portabilità</p><h2>Backup ed esportazione</h2></div>
          <Database />
        </div>
        <div className="settings-actions">
          <Button onClick={exportJson}><Download /> Esporta database JSON</Button>
          <Button variant="secondary" onClick={exportCsv}><Download /> Esporta storico CSV</Button>
          <input ref={fileRef} className="visually-hidden" type="file" accept="application/json" onChange={(event) => importFile(event.target.files?.[0])} />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload /> Importa JSON</Button>
        </div>
      </Surface>

      <Surface>
        <div className="surface-heading">
          <div><p className="date-label">Dati demo</p><h2>Ripristina la dimostrazione</h2></div>
          <RotateCcw />
        </div>
        <Button variant="secondary" onClick={async () => { await seedDemoData(); setStatus("Seed demo ripristinato."); }}>
          <RotateCcw /> Ripristina seed demo
        </Button>
      </Surface>

      <Surface className="safety-settings">
        <div className="surface-heading">
          <div><p className="date-label">Limiti clinici</p><h2>Sicurezza</h2></div>
          <Shield />
        </div>
        <p>Assetto non formula diagnosi né protocolli riabilitativi. Sintomi neurologici producono uno stop.</p>
      </Surface>

      <Surface className="danger-zone">
        <div className="surface-heading">
          <div><p className="date-label">Zona dati</p><h2>Cancella tutto</h2></div>
          <Trash2 />
        </div>
        <Button variant="danger" onClick={deleteAll}>
          <Trash2 /> {deleteStep === 0 ? "Inizia cancellazione" : deleteStep === 1 ? "Conferma cancellazione" : "Cancella definitivamente"}
        </Button>
      </Surface>

      {status ? <p className="success-message" role="status">{status}</p> : null}
    </div>
  );
}
