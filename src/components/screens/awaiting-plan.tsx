"use client";

import { Clock3, HeartPulse, RefreshCw, UserRound } from "lucide-react";
import { syncAssignedPlanFromCloud } from "@/lib/plan-sync";
import { useTabNavigation } from "@/lib/tab-navigation";
import { Button, Surface } from "../ui";

export function AwaitingPlanScreen() {
  const navigateToTab = useTabNavigation();

  return (
    <div className="screen-stack awaiting-plan">
      <header className="section-heading">
        <p className="date-label">Account attivo</p>
        <h1>Il trainer sta preparando il piano.</h1>
        <p>Intanto puoi collegare Apple Health e tenere il profilo aggiornato.</p>
      </header>

      <Surface>
        <div className="surface-heading">
          <div><p className="date-label">Cosa fare ora</p><h2>Tre passi semplici</h2></div>
          <Clock3 />
        </div>
        <ol className="awaiting-plan-steps">
          <li><span>1</span><div><strong>Collega Health</strong><p>Da Impostazioni o dall’app iPhone: corsa, FC, respiro e sonno arriveranno automaticamente.</p></div></li>
          <li><span>2</span><div><strong>Controlla aggiornamenti</strong><p>Quando il piano è pronto lo trovi subito su web e iOS.</p></div></li>
          <li><span>3</span><div><strong>Apri Oggi</strong><p>La home mostrerà una sola seduta da iniziare.</p></div></li>
        </ol>
        <div className="primary-actions primary-actions-stack">
          <Button onClick={async () => { const result = await syncAssignedPlanFromCloud(); if (result.plan) window.location.reload(); }}>
            <RefreshCw /> Controlla aggiornamenti
          </Button>
          <Button variant="secondary" onClick={() => navigateToTab("settings")}>
            <HeartPulse /> Vai a Impostazioni / Health
          </Button>
        </div>
      </Surface>

      <Surface className="privacy-panel">
        <UserRound />
        <div>
          <h2>Il tuo profilo è già sincronizzato</h2>
          <p>Non devi ripetere l’onboarding su un altro dispositivo.</p>
        </div>
      </Surface>
    </div>
  );
}
