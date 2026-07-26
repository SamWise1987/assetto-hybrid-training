"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Bell, ClipboardList, Settings, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { useTabNavigation } from "@/lib/tab-navigation";
import type { AppTab } from "@/lib/store";

const links: { id: AppTab; label: string; description: string; icon: typeof Settings }[] = [
  { id: "inbox", label: "Avvisi", description: "Messaggi dal trainer e aggiornamenti piano", icon: Bell },
  { id: "analysis", label: "Analisi", description: "Suggerimenti settimanali e attività Health", icon: Sparkles },
  { id: "exercises", label: "Le mie schede", description: "Template assegnati e anteprima esercizi", icon: ClipboardList },
  { id: "settings", label: "Impostazioni", description: "Account, Health, export e notifiche", icon: Settings },
];

export function MoreScreen() {
  const unread = useLiveQuery(() => db.notifications.filter((item) => !item.readAt).count()) ?? 0;
  const navigateToTab = useTabNavigation();

  return (
    <div className="screen-stack more-screen">
      <header className="section-heading">
        <p className="date-label">Menu</p>
        <h1>Altro</h1>
        <p>Analisi, avvisi e impostazioni senza appesantire la navigazione principale.</p>
      </header>
      <nav className="more-link-list" aria-label="Altre sezioni">
        {links.map(({ id, label, description, icon: Icon }) => (
          <button key={id} type="button" className="more-link" onClick={() => navigateToTab(id)}>
            <span className="more-link-icon"><Icon aria-hidden="true" /></span>
            <span className="more-link-copy">
              <strong>{label}{id === "inbox" && unread ? ` (${unread > 9 ? "9+" : unread})` : ""}</strong>
              <small>{description}</small>
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
