"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Cloud,
  Download,
  LogIn,
  LogOut,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import {
  buildTrainingSnapshot,
  deterministicCoachReview,
} from "@/lib/ai-coach";
import { clearDatabase, db, exportDatabase, exportHistoryCsv, getActiveBlockWeek, importDatabase } from "@/lib/db";
import {
  cloudSyncAvailable,
  getRemoteUserEmail,
  pullSnapshotFromCloud,
  pushSnapshotToCloud,
  signInWithPassword,
  signOutRemote,
  syncAccountProfile,
} from "@/lib/remote-sync";
import { TEMPLATES } from "@/lib/program";
import { OpenAICoachAdapter } from "@/lib/sync-adapter";
import { IntegrationsPanel } from "../integrations-panel";
import { Button, Field, Surface } from "../ui";

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

const roleLabels = {
  admin: "Amministratore",
  coach: "Trainer",
  athlete: "Atleta",
} as const;

export function SettingsScreen() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [deleteStep, setDeleteStep] = useState(0);
  const [coachBusy, setCoachBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remoteEmail, setRemoteEmail] = useState<string | null>(null);
  const account = useLiveQuery(() => db.accountProfiles.toCollection().first());
  const latestReview = useLiveQuery(() => db.coachReviews.orderBy("date").last());
  const blockWeek = useLiveQuery(() => getActiveBlockWeek(), [], 4);
  const syncEnabled = cloudSyncAvailable();

  useEffect(() => {
    getRemoteUserEmail().then(setRemoteEmail).catch(() => setRemoteEmail(null));
    syncAccountProfile().catch(() => undefined);
  }, [status]);

  const exportJson = async () => {
    download(`backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await exportDatabase(), null, 2), "application/json");
    setStatus("Backup esportato con successo.");
  };

  const exportCsv = async () => {
    download("storico-allenamenti.csv", await exportHistoryCsv(), "text/csv");
    setStatus("Storico esportato in CSV.");
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      await importDatabase(JSON.parse(await file.text()));
      setStatus("Backup ripristinato.");
    } catch {
      setStatus("File non valido. Controlla il formato JSON.");
    }
  };

  const deleteAll = async () => {
    if (deleteStep < 2) {
      setDeleteStep(deleteStep + 1);
      return;
    }
    await clearDatabase();
    setDeleteStep(0);
    setStatus("Tutti i dati sono stati cancellati.");
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

      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });
      if (response.ok) {
        const body = (await response.json()) as { review: typeof review; fallback?: boolean };
        review = body.review;
        source = body.fallback ? "deterministic" : "openai";
      } else {
        const adapter = new OpenAICoachAdapter();
        const fallback = (await adapter.review(snapshot)) as { review: typeof review; fallback?: boolean };
        review = fallback.review;
        source = fallback.fallback ? "deterministic" : "openai";
      }

      await db.coachReviews.put({ ...review, source });
      await db.appSettings.put({
        id: "app-settings",
        aiCoachEnabled: true,
        aiModel: "gpt-4.1-mini",
        lastCoachReviewAt: new Date().toISOString(),
      });
      setStatus("Analisi settimanale completata.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Analisi non disponibile al momento.");
    } finally {
      setCoachBusy(false);
    }
  };

  const login = async () => {
    if (!email.includes("@") || password.length < 6) {
      setStatus("Inserisci email e password validi.");
      return;
    }
    setLoginBusy(true);
    try {
      await signInWithPassword(email, password);
      await syncAccountProfile();
      const loggedEmail = await getRemoteUserEmail();
      setRemoteEmail(loggedEmail);
      setPassword("");
      setStatus(loggedEmail ? `Bentornato, ${loggedEmail}` : "Accesso effettuato.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Credenziali non valide.");
    } finally {
      setLoginBusy(false);
    }
  };

  const logout = async () => {
    await signOutRemote();
    await db.accountProfiles.clear();
    setRemoteEmail(null);
    setStatus("Disconnesso.");
  };

  const pushCloud = async () => {
    setSyncBusy(true);
    try {
      const payload = await exportDatabase();
      await pushSnapshotToCloud(payload, true);
      setStatus("Dati sincronizzati nel cloud.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sincronizzazione non riuscita.");
    } finally {
      setSyncBusy(false);
    }
  };

  const pullCloud = async () => {
    setSyncBusy(true);
    try {
      const payload = await pullSnapshotFromCloud();
      if (!payload) {
        setStatus("Nessun backup trovato nel cloud.");
        return;
      }
      await importDatabase(payload);
      setStatus("Dati ripristinati dal cloud.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ripristino non riuscito.");
    } finally {
      setSyncBusy(false);
    }
  };

  const isLoggedIn = Boolean(remoteEmail || account?.email);
  const displayEmail = remoteEmail ?? account?.email;
  const displayRole = account?.role;

  return (
    <div className="screen-stack">
      <header className="section-heading">
        <p className="date-label">Profilo</p>
        <h1>Impostazioni</h1>
        <p>Gestisci il tuo account, i dati e le preferenze di allenamento.</p>
      </header>

      <Surface className="account-panel">
        <div className="surface-heading">
          <div>
            <p className="date-label">Accesso</p>
            <h2>{isLoggedIn ? "Il tuo account" : "Accedi"}</h2>
          </div>
          <User />
        </div>

        {isLoggedIn ? (
          <>
            <div className="account-badge">
              <div>
                <strong>{displayEmail}</strong>
                {displayRole ? <span className={`role-chip role-${displayRole}`}>{roleLabels[displayRole]}</span> : null}
              </div>
            </div>
            {syncEnabled ? (
              <div className="settings-actions">
                <Button variant="secondary" onClick={pushCloud} disabled={syncBusy}>
                  <Cloud /> Sincronizza dati
                </Button>
                <Button variant="secondary" onClick={pullCloud} disabled={syncBusy}>
                  <Download /> Ripristina dal cloud
                </Button>
              </div>
            ) : null}
            <Button variant="ghost" onClick={logout}>
              <LogOut /> Esci dall&apos;account
            </Button>
          </>
        ) : syncEnabled ? (
          <>
            <p>Accedi con le credenziali fornite dal tuo trainer o amministratore.</p>
            <Field
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button onClick={login} disabled={loginBusy}>
              <LogIn /> {loginBusy ? "Accesso in corso…" : "Accedi"}
            </Button>
          </>
        ) : (
          <p>Il servizio di accesso non è ancora configurato. Contatta l&apos;amministratore.</p>
        )}
      </Surface>

      <IntegrationsPanel onStatus={setStatus} />

      <Surface>
        <div className="surface-heading">
          <div>
            <p className="date-label">Progressi</p>
            <h2>Analisi settimanale</h2>
          </div>
          <Sparkles />
        </div>
        <p>Ricevi un riepilogo automatico della settimana con suggerimenti per la prossima fase.</p>
        <Button onClick={runCoachReview} disabled={coachBusy}>
          <Sparkles /> {coachBusy ? "Analisi in corso…" : "Avvia analisi"}
        </Button>
        {latestReview ? (
          <aside className="coach-review-card">
            <strong>{latestReview.summary}</strong>
            <ul>
              {latestReview.nextWeekFocus.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </aside>
        ) : null}
      </Surface>

      <Surface>
        <div className="surface-heading">
          <div>
            <p className="date-label">Dati</p>
            <h2>Backup e esportazione</h2>
          </div>
          <Download />
        </div>
        <p>Esporta o importa i tuoi allenamenti per conservarli o trasferirli su un altro dispositivo.</p>
        <div className="settings-actions">
          <Button onClick={exportJson}><Download /> Esporta backup</Button>
          <Button variant="secondary" onClick={exportCsv}><Download /> Esporta storico CSV</Button>
          <input ref={fileRef} className="visually-hidden" type="file" accept="application/json" onChange={(event) => importFile(event.target.files?.[0])} />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload /> Importa backup</Button>
        </div>
      </Surface>

      <Surface className="safety-settings">
        <div className="surface-heading">
          <div>
            <p className="date-label">Sicurezza</p>
            <h2>Limiti e avvertenze</h2>
          </div>
          <Shield />
        </div>
        <p>Questa app supporta l&apos;allenamento ma non sostituisce il parere di medico, fisiatra o fisioterapista. In caso di sintomi neurologici, interrompi subito l&apos;attività.</p>
      </Surface>

      <Surface className="danger-zone">
        <div className="surface-heading">
          <div>
            <p className="date-label">Zona pericolosa</p>
            <h2>Cancella tutti i dati</h2>
          </div>
          <Trash2 />
        </div>
        <p>Questa azione è irreversibile. Tutti gli allenamenti, i progressi e le impostazioni verranno eliminati.</p>
        <Button variant="danger" onClick={deleteAll}>
          <Trash2 /> {deleteStep === 0 ? "Inizia cancellazione" : deleteStep === 1 ? "Conferma cancellazione" : "Cancella definitivamente"}
        </Button>
      </Surface>

      {status ? <p className="success-message" role="status">{status}</p> : null}
    </div>
  );
}
