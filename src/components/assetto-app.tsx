"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { BarChart3, CalendarDays, Dumbbell, Home, Settings } from "lucide-react";
import { db } from "@/lib/db";
import { useAppStore, type AppTab } from "@/lib/store";
import { Onboarding } from "./onboarding";
import { TodayScreen } from "./screens/today/index";
import { CalendarScreen } from "./screens/calendar";
import { ProgressScreen } from "./screens/progress";
import { ExercisesScreen } from "./screens/exercises";
import { SettingsScreen } from "./screens/settings";

const tabs: { id: AppTab; label: string; icon: typeof Home }[] = [
  { id: "today", label: "Oggi", icon: Home },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "progress", label: "Progressi", icon: BarChart3 },
  { id: "exercises", label: "Esercizi", icon: Dumbbell },
  { id: "settings", label: "Impostazioni", icon: Settings },
];

export function AssettoApp() {
  const profile = useLiveQuery(() => db.profiles.toCollection().first(), [], null);
  const { tab, setTab } = useAppStore();

  if (!profile) return <Onboarding />;

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="wordmark">Assetto</span>
        <span className="local-status"><Home size={17} aria-hidden="true" /> Locale <i /></span>
      </header>
      <main id="main-content" className="main-content">
        {tab === "today" ? <TodayScreen /> : null}
        {tab === "calendar" ? <CalendarScreen /> : null}
        {tab === "progress" ? <ProgressScreen /> : null}
        {tab === "exercises" ? <ExercisesScreen /> : null}
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
