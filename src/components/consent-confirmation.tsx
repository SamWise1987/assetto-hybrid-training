"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import { ONBOARDING_CONSENT_VERSION } from "@/lib/consent";
import { getRemoteAccessToken, migrateLocalDataForAccount } from "@/lib/remote-sync";
import { reportAppError } from "@/lib/error-monitor";
import { Button } from "./ui";

export function ConsentConfirmation() {
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const confirm = async () => {
    setBusy(true);
    setStatus("");
    try {
      const token = await getRemoteAccessToken();
      if (!token) throw new Error("Sessione scaduta. Accedi di nuovo.");
      const response = await fetch("/api/me/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ consentAccepted: true, consentVersion: ONBOARDING_CONSENT_VERSION }),
      });
      const result = await response.json().catch(() => ({})) as { consentAcceptedAt?: string; consentVersion?: string; error?: string };
      if (!response.ok || !result.consentAcceptedAt) throw new Error(result.error ?? "Salvataggio del consenso non riuscito.");
      const current = await db.athleteProfiles.get("athlete-profile");
      if (!current) throw new Error("Profilo atleta locale non disponibile.");
      await db.athleteProfiles.put({ ...current, consentAcceptedAt: result.consentAcceptedAt, consentVersion: result.consentVersion ?? ONBOARDING_CONSENT_VERSION, updatedAt: new Date().toISOString() });
      await migrateLocalDataForAccount(current.userId, { consentAccepted: true })
        .catch((error) => reportAppError("sync", error, { operation: "local-data-migration" }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Salvataggio del consenso non riuscito.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="main-content" className="onboarding-shell">
      <header className="brand-row"><span className="wordmark">RobertaFunctional</span></header>
      <section className="onboarding-hero">
        <p className="date-label">Aggiornamento account</p>
        <h1>Prima di continuare.</h1>
        <p>Conferma le condizioni correnti. La scelta viene sincronizzata sul tuo account.</p>
      </section>
      <div className="onboarding-profile">
        <label className="consent-row" htmlFor="legacy-disclaimer-consent"><input id="legacy-disclaimer-consent" type="checkbox" checked={disclaimerAccepted} onChange={(event) => setDisclaimerAccepted(event.target.checked)} /><span>Ho compreso che questa app non sostituisce medico, fisiatra o fisioterapista.</span></label>
        <label className="consent-row" htmlFor="legacy-privacy-consent"><input id="legacy-privacy-consent" type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} /><span>Ho letto l’<a href="/privacy" target="_blank" rel="noreferrer">informativa privacy</a> e acconsento al trattamento dei dati inseriti per erogare il servizio.</span></label>
        <Button disabled={!disclaimerAccepted || !privacyAccepted || busy} onClick={confirm}>{busy ? "Salvataggio…" : "Conferma e continua"}</Button>
        {status ? <p className="error-message" role="alert">{status}</p> : null}
      </div>
    </main>
  );
}
