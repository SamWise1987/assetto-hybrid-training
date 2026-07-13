"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BarChart3, CalendarDays, ClipboardList, Dumbbell, Home, Settings, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { canManagePlans } from "@/lib/roles";
import { getRemoteUserEmail, syncAccountProfile } from "@/lib/remote-sync";
import { syncAssignedPlanFromCloud } from "@/lib/plan-sync";
import { useAppStore, type AppTab } from "@/lib/store";
import { getDisplayName } from "@/lib/user-display";
import { Onboarding } from "./onboarding";
import { TodayScreen } from "./screens/today/index";
import { CalendarScreen } from "./screens/calendar";
import { ProgressScreen } from "./screens/progress";
import { ExercisesScreen } from "./screens/exercises";
import { MySchedeScreen } from "./screens/my-schede";
import { CoachScreen } from "./screens/coach";
import { SettingsScreen } from "./screens/settings";

const athleteTabs: { id: AppTab; label: string; icon: typeof Home }[] = [
  { id: "today", label: "Oggi", icon: Home },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "progress", label: "Progressi", icon: BarChart3 },
  { id: "exercises", label: "Esercizi", icon: Dumbbell },
  { id: "settings", label: "Impostazioni", icon: Settings },
];

const staffTabs: { id: AppTab; label: string; icon: typeof Home }[] = [
  { id: "today", label: "Oggi", icon: Home },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "progress", label: "Progressi", icon: BarChart3 },
  { id: "exercises", label: "Esercizi", icon: Dumbbell },
  { id: "coach", label: "Coach", icon: ClipboardList },
  { id: "settings", label: "Impostazioni", icon: Settings },
];

export function AssettoApp() {
  const profile = useLiveQuery(() => db.profiles.toCollection().first(), [], null);
  const account = useLiveQuery(() => db.accountProfiles.toCollection().first());
  const { tab, setTab, planNotice, setPlanNotice, setIntegrationMessage } = useAppStore();
  const [remoteEmail, setRemoteEmail] = useState<string | null>(null);
  const isStaff = canManagePlans(account?.role);
  const tabs = isStaff ? staffTabs : athleteTabs;

  useEffect(() => {
    const bootstrap = async () => {
      await syncAccountProfile().catch(() => undefined);
      const result = await syncAssignedPlanFromCloud().catch(() => null);
      if (result?.isNew && result.plan) {
        setPlanNotice({ planName: result.plan.name, assignedAt: result.assignment?.assignedAt ?? new Date().toISOString() });
      }
      const loggedEmail = await getRemoteUserEmail().catch(() => null);
      setRemoteEmail(loggedEmail);
    };
    bootstrap().catch(() => undefined);

    const params = new URLSearchParams(window.location.search);
    const integration = params.get("integrations");
    if (integration === "strava-connected") {
      setIntegrationMessage("Strava collegato. Puoi importare le corse da Impostazioni.");
    } else if (integration === "strava-denied") {
      setIntegrationMessage("Collegamento Strava annullato.");
    } else if (integration === "strava-error") {
      setIntegrationMessage("Errore nel collegamento Strava. Riprova.");
    }
    if (integration) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [setIntegrationMessage, setPlanNotice]);

  useEffect(() => {
    if (!isStaff && tab === "coach") {
      setTab("today");
    }
  }, [isStaff, setTab, tab]);

  if (!profile) return <Onboarding />;

  const displayName = getDisplayName(
    account ?? (remoteEmail ? { displayName: "", email: remoteEmail } : null),
    profile,
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="wordmark">RobertaFunctional</span>
        <span className="cloud-status" title={account?.email ?? remoteEmail ?? "Profilo locale"}>
          <UserRound size={17} aria-hidden="true" />
          <span className="user-chip-name">{displayName}</span>
          <i />
        </span>
      </header>
      <main id="main-content" className="main-content">
        {planNotice ? (
          <div className="plan-notice" role="status">
            <strong>Nuovo piano dal trainer: {planNotice.planName}</strong>
            <button type="button" onClick={() => setPlanNotice(null)} aria-label="Chiudi avviso">×</button>
          </div>
        ) : null}
        {tab === "today" ? <TodayScreen /> : null}
        {tab === "calendar" ? <CalendarScreen /> : null}
        {tab === "progress" ? <ProgressScreen /> : null}
        {tab === "exercises" ? (isStaff ? <ExercisesScreen /> : <MySchedeScreen />) : null}
        {tab === "coach" && isStaff ? <CoachScreen /> : null}
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
