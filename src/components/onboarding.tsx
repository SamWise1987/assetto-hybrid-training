"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Cloud, Dumbbell, HeartPulse, Shield } from "lucide-react";
import { seedInitialData } from "@/lib/db";
import { Button } from "./ui";

export function Onboarding() {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);

  const createPlan = async () => {
    setBusy(true);
    try {
      await seedInitialData();
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch (error) {
      console.error("Creazione piano fallita", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="main-content" className="onboarding-shell" data-hydrated={hydrated}>
      <header className="brand-row">
        <span className="wordmark">RobertaFunctional</span>
        <span className="cloud-status"><Cloud size={16} /> Online</span>
      </header>
      <section className="onboarding-hero">
        <p className="date-label">Allenamento ibrido professionale</p>
        <h1>Il tuo piano si adatta.<br />Le regole restano chiare.</h1>
        <p>Otto settimane per costruire forza, mantenere la corsa e monitorare i progressi in modo intelligente.</p>
      </section>
      <div className="onboarding-list">
        <article><Dumbbell /><div><h2>Libreria completa</h2><p>Oltre 800 esercizi con immagini, muscoli e attrezzatura.</p></div><Check /></article>
        <article><HeartPulse /><div><h2>Progressione automatica</h2><p>Il sistema adatta carichi e volume in base ai tuoi risultati.</p></div><Check /></article>
        <article><Shield /><div><h2>Sicurezza integrata</h2><p>Check-in pre-allenamento e stop automatici in caso di segnali di rischio.</p></div><Check /></article>
      </div>
      <label className="consent-row" htmlFor="disclaimer-consent">
        <input
          id="disclaimer-consent"
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        <span>Ho compreso che questa app non sostituisce medico, fisiatra o fisioterapista.</span>
      </label>
      <Button disabled={!hydrated || !accepted || busy} onClick={createPlan}>{busy ? "Preparo il piano…" : "Inizia il tuo percorso"}</Button>
    </main>
  );
}
