"use client";

import { useState } from "react";
import { Cloud, KeyRound, LogIn, Mail, ShieldCheck } from "lucide-react";
import { cloudSyncAvailable, sendPasswordReset, signInWithPassword, updateRemotePassword } from "@/lib/remote-sync";
import { Button, Field, Surface } from "./ui";

export function AuthGate({ onAuthenticated, passwordSetup = false }: { onAuthenticated: () => void; passwordSetup?: boolean }) {
  const [mode, setMode] = useState<"login" | "reset" | "password">(passwordSetup ? "password" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const submit = async () => {
    setBusy(true);
    setStatus("");
    try {
      if (mode === "reset") {
        if (!email.includes("@")) throw new Error("Inserisci un indirizzo email valido.");
        await sendPasswordReset(email);
        setStatus("Controlla la posta: ti abbiamo inviato il link per scegliere una nuova password.");
        return;
      }
      if (password.length < 8) throw new Error("La password deve avere almeno 8 caratteri.");
      if (mode === "password") {
        await updateRemotePassword(password);
      } else {
        if (!email.includes("@")) throw new Error("Inserisci un indirizzo email valido.");
        await signInWithPassword(email, password);
      }
      onAuthenticated();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Accesso non riuscito.");
    } finally {
      setBusy(false);
    }
  };

  if (!cloudSyncAvailable()) {
    return (
      <main id="main-content" className="auth-shell">
        <Surface className="auth-card">
          <ShieldCheck />
          <h1>Servizio account non configurato</h1>
          <p>Configura Supabase per utilizzare la piattaforma cliente–trainer.</p>
        </Surface>
      </main>
    );
  }

  return (
    <main id="main-content" className="auth-shell">
      <header className="brand-row auth-brand">
        <span className="wordmark">RobertaFunctional</span>
        <span className="cloud-status"><Cloud size={16} /> Web · iPhone · Android</span>
      </header>
      <section className="auth-intro">
        <h1>{mode === "password" ? "Proteggi il tuo account." : "Il tuo allenamento, ovunque."}</h1>
        <p>Accedi per ritrovare il piano del trainer, lo storico e le attività sincronizzate su tutti i dispositivi.</p>
      </section>
      <Surface className="auth-card account-panel">
        <div className="surface-heading">
          <div>
            <p className="date-label">Accesso personale</p>
            <h2>{mode === "reset" ? "Recupera password" : mode === "password" ? "Scegli la password" : "Bentornato/a"}</h2>
          </div>
          {mode === "reset" ? <Mail /> : mode === "password" ? <KeyRound /> : <LogIn />}
        </div>
        {mode !== "password" ? (
          <Field label="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        ) : null}
        {mode !== "reset" ? (
          <Field label="Password" type="password" autoComplete={mode === "password" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} hint="Minimo 8 caratteri" />
        ) : null}
        <Button onClick={submit} disabled={busy}>{busy ? "Attendi…" : mode === "reset" ? "Invia link" : mode === "password" ? "Salva e continua" : "Accedi"}</Button>
        {mode !== "password" ? (
          <Button variant="ghost" onClick={() => { setMode(mode === "reset" ? "login" : "reset"); setStatus(""); }}>
            {mode === "reset" ? "Torna all’accesso" : "Hai dimenticato la password?"}
          </Button>
        ) : null}
        {status ? <p className="info-message" role="status">{status}</p> : null}
      </Surface>
      <p className="auth-invite-note">Gli account vengono creati su invito del trainer o dell’amministratore.</p>
    </main>
  );
}
