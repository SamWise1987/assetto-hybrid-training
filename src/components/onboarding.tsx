"use client";

import { useState, useSyncExternalStore } from "react";
import { CalendarDays, Check, ChevronLeft, Cloud, Dumbbell, HeartPulse, Shield, Smartphone } from "lucide-react";
import { db, seedInitialData } from "@/lib/db";
import { getNativeHealthAvailability, importNativeWorkouts, recordNativeHealthFailure } from "@/lib/native-health";
import { getRemoteAccessToken, migrateLocalDataForAccount } from "@/lib/remote-sync";
import { reportAppError } from "@/lib/error-monitor";
import type { PreferredGreeting } from "@/lib/types";
import { ONBOARDING_CONSENT_VERSION } from "@/lib/consent";
import { Button, Field } from "./ui";

const DAYS = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const EQUIPMENT_OPTIONS = ["Corpo libero", "Manubri", "Panca", "Elastici", "Tapis roulant"];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [greeting, setGreeting] = useState<PreferredGreeting>("neutral");
  const [goal, setGoal] = useState("Ipertrofia e forza");
  const [trainingDays, setTrainingDays] = useState<number[]>([1, 2, 4, 6]);
  const [equipment, setEquipment] = useState<string[]>(["Corpo libero", "Manubri"]);
  const [limitations, setLimitations] = useState("");
  const [healthStatus, setHealthStatus] = useState<"idle" | "connected" | "skipped" | "unavailable">("idle");
  const [status, setStatus] = useState("");
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);

  const toggleDay = (day: number) => setTrainingDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort());
  const toggleEquipment = (item: string) => setEquipment((current) => current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item]);

  const connectHealth = async () => {
    setBusy(true);
    setStatus("");
    try {
      const availability = await getNativeHealthAvailability();
      if (!availability.available) {
        setHealthStatus("unavailable");
        setStatus("Dal web vedrai i dati sincronizzati dall’app iPhone o Android. Puoi continuare e collegare Health dal telefono.");
        return;
      }
      const imported = await importNativeWorkouts(30);
      setHealthStatus("connected");
      setStatus(`Health collegato: ${imported.imported} attività iniziali sincronizzate.`);
    } catch (error) {
      await recordNativeHealthFailure(error);
      setStatus(error instanceof Error ? error.message : "Collegamento Health non riuscito.");
    } finally {
      setBusy(false);
    }
  };

  const completeOnboarding = async () => {
    setBusy(true);
    setStatus("");
    try {
      const token = await getRemoteAccessToken();
      if (!token) throw new Error("Sessione scaduta. Accedi di nuovo per completare il profilo.");
      const response = await fetch("/api/me/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          displayName: name.trim() || "Atleta", primaryGoal: goal, trainingDays, equipment,
          limitations: limitations.split(",").map((item) => item.trim()).filter(Boolean),
          healthSkipped: healthStatus !== "connected", consentAccepted: true,
          consentVersion: ONBOARDING_CONSENT_VERSION,
        }),
      });
      const result = await response.json().catch(() => ({})) as { completedAt?: string; consentAcceptedAt?: string; error?: string };
      if (!response.ok || !result.completedAt || !result.consentAcceptedAt) throw new Error(result.error ?? "Salvataggio del profilo non riuscito.");
      await seedInitialData({ name: name.trim() || "Atleta", preferredGreeting: greeting });
      const account = await db.accountProfiles.toCollection().first();
      await db.athleteProfiles.put({
        id: "athlete-profile", userId: account?.userId ?? "local", displayName: name.trim() || "Atleta",
        primaryGoal: goal, secondaryGoals: [], trainingDays, equipment,
        limitations: limitations.split(",").map((item) => item.trim()).filter(Boolean),
        onboardingCompletedAt: result.completedAt,
        healthOnboardingSkippedAt: healthStatus === "connected" ? undefined : result.completedAt,
        consentAcceptedAt: result.consentAcceptedAt, consentVersion: ONBOARDING_CONSENT_VERSION,
        updatedAt: result.completedAt,
      });
      if (account?.userId) {
        await migrateLocalDataForAccount(account.userId, { consentAccepted: true })
          .catch((error) => reportAppError("sync", error, { operation: "local-data-migration" }));
      }
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Completamento onboarding fallito.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="main-content" className="onboarding-shell" data-hydrated={hydrated}>
      <header className="brand-row">
        <span className="wordmark">RobertaFunctional</span>
        <span className="cloud-status"><Cloud size={16} /> Passaggio {step + 1} di 4</span>
      </header>

      {step === 0 ? (
        <>
          <section className="onboarding-hero">
            <p className="date-label">Il tuo profilo</p>
            <h1>Partiamo da te.</h1>
            <p>Il nome e le preferenze restano sincronizzati su web, iPhone e Android.</p>
          </section>
          <div className="onboarding-profile">
            <Field label="Nome o nickname" value={name} onChange={(event) => setName(event.target.value)} placeholder="Es. Alex" autoComplete="nickname" />
            <label className="field"><span>Come preferisci il benvenuto?</span><select value={greeting} onChange={(event) => setGreeting(event.target.value as PreferredGreeting)}><option value="neutral">Benvenuto/a</option><option value="benvenuto">Benvenuto</option><option value="benvenuta">Benvenuta</option></select></label>
          </div>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <section className="onboarding-hero"><p className="date-label">Programmazione</p><h1>Quando ti alleni?</h1><p>Il trainer userà queste informazioni per costruire un piano realistico.</p></section>
          <div className="onboarding-profile">
            <label className="field"><span>Obiettivo principale</span><select value={goal} onChange={(event) => setGoal(event.target.value)}><option>Ipertrofia e forza</option><option>Forza generale</option><option>Corsa e resistenza</option><option>Allenamento ibrido</option></select></label>
            <fieldset className="choice-fieldset"><legend>Giorni disponibili</legend><div className="choice-grid days">{DAYS.map((day, index) => <button key={day} type="button" aria-pressed={trainingDays.includes(index)} onClick={() => toggleDay(index)}>{day}</button>)}</div></fieldset>
            <fieldset className="choice-fieldset"><legend>Attrezzatura</legend><div className="choice-grid equipment">{EQUIPMENT_OPTIONS.map((item) => <button key={item} type="button" aria-pressed={equipment.includes(item)} onClick={() => toggleEquipment(item)}>{item}</button>)}</div></fieldset>
            <Field label="Limitazioni da comunicare al trainer" value={limitations} onChange={(event) => setLimitations(event.target.value)} placeholder="Separate da virgola (facoltativo)" />
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <section className="onboarding-hero"><p className="date-label">Dati allenamento</p><h1>Collega Health.</h1><p>L’app legge gli allenamenti registrati dal telefono o dall’orologio. Non inventa serie o ripetizioni mancanti.</p></section>
          <div className="onboarding-list integration-onboarding">
            <article><HeartPulse /><div><h2>Apple Health / Health Connect</h2><p>Corsa, camminata e riepiloghi degli allenamenti di forza.</p></div>{healthStatus === "connected" ? <Check /> : <Smartphone />}</article>
            <article><Shield /><div><h2>Permessi sotto il tuo controllo</h2><p>Puoi modificare o revocare l’accesso dalle impostazioni del telefono.</p></div><Check /></article>
          </div>
          <div className="onboarding-profile">
            <Button onClick={connectHealth} disabled={busy}>{healthStatus === "connected" ? "Health collegato" : busy ? "Collegamento…" : "Collega Health"}</Button>
            <Button variant="secondary" onClick={() => { setHealthStatus("skipped"); setStep(3); }}>Continua senza Health</Button>
            {status ? <p className="info-message" role="status">{status}</p> : null}
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <section className="onboarding-hero"><p className="date-label">Ultimo passaggio</p><h1>Tutto pronto.</h1><p>Troverai il piano assegnato dal trainer appena sarà pubblicato.</p></section>
          <div className="onboarding-list">
            <article><Dumbbell /><div><h2>Scheda personale</h2><p>Carichi, pause, suggerimenti e progressioni trasparenti.</p></div><Check /></article>
            <article><CalendarDays /><div><h2>Sincronizzata ovunque</h2><p>Web, iPhone e Android condividono piano e storico.</p></div><Check /></article>
          </div>
          <label className="consent-row" htmlFor="disclaimer-consent"><input id="disclaimer-consent" type="checkbox" checked={disclaimerAccepted} onChange={(event) => setDisclaimerAccepted(event.target.checked)} /><span>Ho compreso che questa app non sostituisce medico, fisiatra o fisioterapista.</span></label>
          <label className="consent-row" htmlFor="privacy-consent"><input id="privacy-consent" type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} /><span>Ho letto l’<a href="/privacy" target="_blank" rel="noreferrer">informativa privacy</a> e acconsento al trattamento dei dati inseriti per erogare il servizio.</span></label>
        </>
      ) : null}

      <div className="onboarding-navigation">
        {step > 0 ? <Button variant="ghost" onClick={() => setStep((current) => current - 1)}><ChevronLeft /> Indietro</Button> : <span />}
        {step < 3 ? <Button disabled={step === 0 && !name.trim()} onClick={() => setStep((current) => current + 1)}>Continua</Button> : <Button disabled={!hydrated || !disclaimerAccepted || !privacyAccepted || busy} onClick={completeOnboarding}>{busy ? "Salvataggio…" : "Entra nell’app"}</Button>}
      </div>
    </main>
  );
}
