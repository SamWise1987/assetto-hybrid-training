"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Dumbbell, HeartPulse, LockKeyhole } from "lucide-react";
import { seedDemoData } from "@/lib/db";
import { Button } from "./ui";

export function Onboarding() {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);

  const createPlan = async () => {
    setBusy(true);
    await seedDemoData();
    window.scrollTo({ top: 0, behavior: "auto" });
    setBusy(false);
  };

  return (
    <main id="main-content" className="onboarding-shell" data-hydrated={hydrated}>
      <header className="brand-row"><span className="wordmark">Assetto</span><span className="local-status"><LockKeyhole size={16} /> Locale</span></header>
      <section className="onboarding-hero">
        <p className="date-label">Forza + corsa, senza rumore</p>
        <h1>Il tuo piano si adatta.<br />Le regole restano visibili.</h1>
        <p>Otto settimane per costruire massa, mantenere la corsa e proteggere i segnali che non vanno ignorati.</p>
      </section>
      <div className="onboarding-list">
        <article><Dumbbell /><div><h2>Attrezzatura pronta</h2><p>2 manubri da 16 kg, handle e corpo libero.</p></div><Check /></article>
        <article><HeartPulse /><div><h2>Sicurezza prima del carico</h2><p>I limiti clinici attivano stop e facilitazioni, mai diagnosi o riabilitazione.</p></div><Check /></article>
        <article><LockKeyhole /><div><h2>Dati solo sul dispositivo</h2><p>IndexedDB locale, export completo e nessun account obbligatorio.</p></div><Check /></article>
      </div>
      <label className="consent-row" htmlFor="disclaimer-consent">
        <input
          id="disclaimer-consent"
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        <span>Ho compreso che Assetto non sostituisce medico, fisiatra o fisioterapista.</span>
      </label>
      <Button disabled={!hydrated || !accepted || busy} onClick={createPlan}>{busy ? "Creo il piano…" : "Crea il mio piano"}</Button>
      <p className="quiet-note">Il seed include tre settimane demo realistiche per mostrare progressioni e grafici.</p>
    </main>
  );
}
