"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Smartphone } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button, Surface } from "@/components/ui";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState("Verifica del link in corso…");
  const [ready, setReady] = useState(false);
  const [nativeHref, setNativeHref] = useState("com.robertafunctional.app://auth");
  const [nextHref, setNextHref] = useState("/");

  useEffect(() => {
    const hash = window.location.hash;
    const query = window.location.search;
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(query);
    const type = hashParams.get("type") ?? queryParams.get("type") ?? "invite";
    const client = createBrowserSupabaseClient();
    if (!client) { queueMicrotask(() => setStatus("Servizio account non configurato.")); return; }
    client.auth.getSession().then(({ data, error }) => {
      setNativeHref(`com.robertafunctional.app://auth${query}${hash}`);
      setNextHref(`/?type=${encodeURIComponent(type)}`);
      if (error) { setStatus("Il link non è valido o è scaduto."); return; }
      if (data.session) { setReady(true); setStatus("Account verificato. Puoi continuare sul web oppure aprire l’app."); }
      else setStatus("Apri l’app oppure richiedi un nuovo link se questo è scaduto.");
    });
  }, []);

  return <main id="main-content" className="auth-shell"><section className="auth-intro"><span className="wordmark">RobertaFunctional</span><h1>Continua dove preferisci.</h1><p>Lo stesso account funziona su web, iPhone e Android.</p></section><Surface className="auth-card account-panel"><Smartphone /><h2>Link account</h2><p role="status">{status}</p><div className="settings-actions"><a className="button button-primary" href={nativeHref}><Smartphone /> Apri l’app</a><Button disabled={!ready} onClick={() => { window.location.href = nextHref; }}><ArrowRight /> Continua sul web</Button></div></Surface></main>;
}
