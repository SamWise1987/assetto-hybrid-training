"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, Bell, CheckCheck } from "lucide-react";
import type { AppNotification } from "@/lib/types";
import { Button, EmptyState, Surface } from "../ui";
import { enablePushNotifications } from "@/lib/push-client";
import { db, markNotificationRead } from "@/lib/db";
import { flushSyncQueue } from "@/lib/normalized-sync";
import { reportAppError } from "@/lib/error-monitor";
import { notificationHrefForTab, notificationTabFromHref } from "@/lib/notification-routing";
import { useAppStore } from "@/lib/store";

export function InboxScreen() {
  const items = useLiveQuery(() => db.notifications.orderBy("createdAt").reverse().toArray(), [], []);
  const [pushStatus, setPushStatus] = useState("");
  const setTab = useAppStore((state) => state.setTab);
  const markRead = async (id: string) => {
    await markNotificationRead(id);
    await flushSyncQueue();
  };

  const openNotification = (item: AppNotification) => {
    if (!item.readAt) markRead(item.id).catch((error) => reportAppError("notifications", error).catch(() => undefined));
    const targetTab = notificationTabFromHref(item.href, window.location.origin);
    if (!targetTab) return;
    setTab(targetTab);
    window.history.pushState({}, "", notificationHrefForTab(targetTab));
  };

  return <div className="screen-stack"><header className="section-heading"><p className="date-label">Aggiornamenti condivisi</p><h1>Avvisi</h1><p>Piani, analisi e sincronizzazioni importanti per te.</p></header><Surface><div className="surface-heading"><div><p className="date-label">Fuori dall’app</p><h2>Notifiche push</h2></div><Bell /></div><p className="supporting-copy">Le anteprime non includono dati sanitari sensibili. Se le push non sono disponibili, inbox e badge continuano a funzionare.</p><Button variant="ghost" onClick={() => enablePushNotifications().then((platform) => setPushStatus(`Notifiche attive su ${platform}.`)).catch((error) => { reportAppError("notifications", error).catch(() => undefined); setPushStatus(error instanceof Error ? error.message : "Notifiche non disponibili."); })}>Attiva notifiche</Button>{pushStatus ? <p role="status">{pushStatus}</p> : null}</Surface><Surface><div className="surface-heading"><h2>Inbox</h2><Bell /></div>{items.length ? <div className="notification-list">{items.map((item) => <article key={item.id} className={item.readAt ? "is-read" : ""}><div><strong>{item.title}</strong><time>{new Date(item.createdAt).toLocaleString("it-IT")}</time></div><p>{item.body}</p><div className="button-row">{item.href ? <Button onClick={() => openNotification(item)} aria-label={`Apri avviso: ${item.title}`}><ArrowRight /> Apri</Button> : null}{!item.readAt ? <Button variant="ghost" onClick={() => markRead(item.id)}><CheckCheck /> Segna come letto</Button> : null}</div></article>)}</div> : <EmptyState title="Nessun avviso" text="Qui appariranno le modifiche del trainer e gli aggiornamenti di sincronizzazione." />}</Surface></div>;
}
