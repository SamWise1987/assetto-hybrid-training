"use client";

import { Clock3, RefreshCw, UserRound } from "lucide-react";
import { syncAssignedPlanFromCloud } from "@/lib/plan-sync";
import { Button, Surface } from "../ui";

export function AwaitingPlanScreen() {
  return <div className="screen-stack awaiting-plan"><header className="section-heading"><p className="date-label">Account attivo</p><h1>Il trainer sta preparando il piano.</h1><p>Nel frattempo puoi collegare Health, consultare l’analisi e aggiornare il profilo.</p></header><Surface><div className="surface-heading"><div><p className="date-label">Stato assegnazione</p><h2>In attesa</h2></div><Clock3 /></div><p>Quando il programma sarà pubblicato riceverai un avviso e lo troverai qui su web, iPhone e Android.</p><Button onClick={async () => { const result = await syncAssignedPlanFromCloud(); if (result.plan) window.location.reload(); }}><RefreshCw /> Controlla aggiornamenti</Button></Surface><Surface className="privacy-panel"><UserRound /><div><h2>Il tuo profilo è già sincronizzato</h2><p>Non devi ripetere l’onboarding su un altro dispositivo.</p></div></Surface></div>;
}
