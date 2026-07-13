"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BarChart3, CalendarDays, ClipboardList, Cloud, Dumbbell, Home, Settings } from "lucide-react";
import { db } from "@/lib/db";
import { canManagePlans } from "@/lib/roles";
import { getRemoteUserEmail, syncAccountProfile } from "@/lib/remote-sync";
import { useAppStore, type AppTab } from "@/lib/store";
import { Onboarding } from "./onboarding";
import { TodayScreen } from "./screens/today/index";
import { CalendarScreen } from "./screens/calendar";
import { ProgressScreen } from "./screens/progress";
import { ExercisesScreen } from "./screens/exercises";
import { CoachScreen } from "./screens/coach";
import { SettingsScreen } from "./screens/settings";

const baseTabs: { id: AppTab; label: string; icon: typeof Home }[] = [
  { id: "today", label: "Oggi", icon: Home },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "progress", label: "Progressi", icon: BarChart3 },
  { id: "exercises", label: "Esercizi", icon: Dumbbell },
  { id: "settings", label: "Impostazioni", icon: Settings },
];

const roleLabels = {
  admin: "Admin",
  coach: "Trainer",
  athlete: "Atleta",
} as const;

export function AssettoApp() {
  const profile = useLiveQuery(() => db.profiles.toCollection().first(), [], null);
  const account = useLiveQuery(() => db.accountProfiles.toCollection().first());
  const { tab, setTab } = useAppStore();
  const [remoteEmail, setRemoteEmail] = useState<string | null>(null);
  const tabs = canManagePlans(account?.role)
    ? [...baseTabs.slice(0, 4), { id: "coach" as const, label: "Coach", icon: ClipboardList }, baseTabs[4]]
    : baseTabs;

  useEffect(() => {
    syncAccountProfile().catch(() => undefined);
    getRemoteUserEmail().then(setRemoteEmail).catch(() => setRemoteEmail(null));
  }, []);

  if (!profile) return <Onboarding />;

  const statusLabel = account?.role
    ? roleLabels[account.role]
    : remoteEmail
      ? "Connesso"
      : "Online";

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="wordmark">RobertaFunctional</span>
        <span className="cloud-status">
          <Cloud size={17} aria-hidden="true" />
          {statusLabel}
          <i />
        </span>
      </header>
      <main id="main-content" className="main-content">
        {tab === "today" ? <TodayScreen /> : null}
        {tab === "calendar" ? <CalendarScreen /> : null}
        {tab === "progress" ? <ProgressScreen /> : null}
        {tab === "exercises" ? <ExercisesScreen /> : null}
        {tab === "coach" ? <CoachScreen /> : null}
        {tab === "settings" ? <SettingsScreen /> : null}
      </main>
      <nav className="bottom-nav" aria-label="Navigazione principale">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={tab === id ? "is-active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
            <Icon aria-hidden="true" /><span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
