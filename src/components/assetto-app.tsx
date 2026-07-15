"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BarChart3, Bell, CalendarDays, ClipboardList, Dumbbell, Home, Settings, Sparkles, UserRound, Users } from "lucide-react";
import { db } from "@/lib/db";
import { canManagePlans } from "@/lib/roles";
import { consumeRemoteAuthCallback, getRemoteAccessToken, getRemoteAuthCallbackParams, getRemoteSession, migrateLocalDataForAccount, onRemoteAuthChange, syncAccountProfile } from "@/lib/remote-sync";
import { useAppStore, type AppTab } from "@/lib/store";
import { getDisplayName } from "@/lib/user-display";
import { Onboarding } from "./onboarding";
import { AuthGate } from "./auth-gate";
import { TodayScreen } from "./screens/today/index";
import { CalendarScreen } from "./screens/calendar";
import { ProgressScreen } from "./screens/progress";
import { ExercisesScreen } from "./screens/exercises";
import { MySchedeScreen } from "./screens/my-schede";
import { CoachScreen } from "./screens/coach";
import { SettingsScreen } from "./screens/settings";
import { AnalysisScreen } from "./screens/analysis";
import { ClientsScreen } from "./screens/clients";
import { InboxScreen } from "./screens/inbox";
import { NativeHealthSync } from "./native-health-sync";
import { AwaitingPlanScreen } from "./screens/awaiting-plan";
import { SyncManager } from "./sync-manager";
import { refreshAthleteCloudState } from "@/lib/cloud-refresh";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { AppNotification, PlanAssignment, TrainingPlan } from "@/lib/types";
import { ErrorMonitor } from "./error-monitor";
import { ConsentConfirmation } from "./consent-confirmation";
import { CloudRefreshManager } from "./cloud-refresh-manager";

const athleteTabs: { id: AppTab; label: string; icon: typeof Home }[] = [
  { id: "today", label: "Oggi", icon: Home },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "progress", label: "Progressi", icon: BarChart3 },
  { id: "analysis", label: "Analisi", icon: Sparkles },
  { id: "inbox", label: "Avvisi", icon: Bell },
  { id: "settings", label: "Impostazioni", icon: Settings },
];

const staffTabs: { id: AppTab; label: string; icon: typeof Home }[] = [
  { id: "clients", label: "Clienti", icon: Users },
  { id: "coach", label: "Piani", icon: ClipboardList },
  { id: "exercises", label: "Libreria", icon: Dumbbell },
  { id: "analysis", label: "Analisi", icon: Sparkles },
  { id: "inbox", label: "Avvisi", icon: Bell },
  { id: "settings", label: "Impostazioni", icon: Settings },
];

export function AssettoApp() {
  const profile = useLiveQuery(() => db.profiles.toCollection().first(), [], null);
  const account = useLiveQuery(() => db.accountProfiles.toCollection().first());
  const athleteProfile = useLiveQuery(() => db.athleteProfiles.get("athlete-profile"), [], null);
  const activeAssignment = useLiveQuery(() => db.planAssignments.filter((item) => item.active).first());
  const unreadNotifications = useLiveQuery(() => db.notifications.filter((item) => !item.readAt).count()) ?? 0;
  const { tab, setTab, planNotice, setPlanNotice, setIntegrationMessage } = useAppStore();
  const [authState, setAuthState] = useState<"loading" | "anonymous" | "authenticated">("loading");
  const [passwordSetup, setPasswordSetup] = useState(() => {
    if (typeof window === "undefined") return false;
    const authType = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type")
      ?? new URLSearchParams(window.location.search).get("type");
    return authType === "invite" || authType === "recovery";
  });
  const [bootstrapDone, setBootstrapDone] = useState(false);
  const isStaff = canManagePlans(account?.role);
  const tabs = isStaff ? staffTabs : athleteTabs;
  const handlePlanChange = useCallback((plan: TrainingPlan, assignment: PlanAssignment | null, kind: "assigned" | "updated", reason?: string) => {
    setPlanNotice({ planName: plan.name, changedAt: assignment?.assignedAt ?? plan.versionCreatedAt ?? new Date().toISOString(), kind, reason });
  }, [setPlanNotice]);

  useEffect(() => {
    getRemoteSession().then((session) => setAuthState(session ? "authenticated" : "anonymous"));
    return onRemoteAuthChange((authenticated) => setAuthState(authenticated ? "authenticated" : "anonymous"));
  }, []);

  useEffect(() => {
    if (authState !== "authenticated") return;
    const bootstrap = async () => {
      const remoteProfile = await syncAccountProfile().catch(() => null);
      if (remoteProfile) await migrateLocalDataForAccount(remoteProfile.userId).catch(() => undefined);
      if (remoteProfile?.role === "athlete") {
        const result = await refreshAthleteCloudState();
        if (result.assignedPlan?.change && result.assignedPlan.plan) {
          handlePlanChange(result.assignedPlan.plan, result.assignedPlan.assignment, result.assignedPlan.change, result.assignedPlan.reason);
        }
      }
      setBootstrapDone(true);
    };
    bootstrap().catch(() => undefined);

    const params = new URLSearchParams(window.location.search);
    const integration = params.get("integrations");
    const requestedTab = params.get("tab") as AppTab | null;
    if (requestedTab && ["today", "calendar", "progress", "analysis", "exercises", "clients", "coach", "inbox", "settings"].includes(requestedTab)) setTab(requestedTab);
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
  }, [authState, handlePlanChange, setIntegrationMessage, setTab]);

  useEffect(() => {
    const staffOnly = tab === "coach" || tab === "clients";
    const athleteOnly = tab === "today" || tab === "calendar" || tab === "progress";
    if (!isStaff && staffOnly) setTab("today");
    if (isStaff && athleteOnly) setTab("clients");
  }, [isStaff, setTab, tab]);

  useEffect(() => {
    let remove: (() => void) | undefined;
    import("@capacitor/app").then(async ({ App }) => {
      const listener = await App.addListener("appUrlOpen", async ({ url }) => {
        const parsed = new URL(url);
        const requestedTab = parsed.searchParams.get("tab") as AppTab | null;
        if (requestedTab && ["today", "calendar", "progress", "analysis", "exercises", "clients", "coach", "inbox", "settings"].includes(requestedTab)) setTab(requestedTab);
        const authType = getRemoteAuthCallbackParams(url).get("type");
        if (await consumeRemoteAuthCallback(url).catch(() => false)) {
          if (authType === "invite" || authType === "recovery") setPasswordSetup(true);
          setAuthState("authenticated");
        }
      });
      remove = () => { listener.remove(); };
    }).catch(() => undefined);
    return () => remove?.();
  }, [setTab]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    const load = async () => {
      const token = await getRemoteAccessToken(); if (!token) return;
      const response = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return;
      const body = await response.json() as { notifications: Array<{ id: string; recipient_user_id: string; actor_user_id: string | null; type: AppNotification["type"]; title: string; body: string; href: string | null; entity_type: string | null; entity_id: string | null; created_at: string; read_at: string | null }> };
      await db.notifications.bulkPut(body.notifications.map((item) => ({ id: item.id, recipientUserId: item.recipient_user_id, actorUserId: item.actor_user_id ?? undefined, type: item.type, title: item.title, body: item.body, href: item.href ?? undefined, entityType: item.entity_type ?? undefined, entityId: item.entity_id ?? undefined, createdAt: item.created_at, readAt: item.read_at ?? undefined })));
    };
    const timeout = window.setTimeout(() => { load().catch(() => undefined); }, 0);
    const client = createBrowserSupabaseClient();
    const channel = client?.channel("global-app-notifications").on("postgres_changes", { event: "*", schema: "public", table: "app_notifications" }, () => { load().catch(() => undefined); }).subscribe();
    return () => { window.clearTimeout(timeout); if (client && channel) client.removeChannel(channel); };
  }, [authState]);

  useEffect(() => {
    let remove: (() => void) | undefined;
    import("@capacitor/push-notifications").then(async ({ PushNotifications }) => {
      const listener = await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const href = typeof notification.data?.href === "string" ? notification.data.href : "/?tab=inbox";
        const requestedTab = new URL(href, window.location.origin).searchParams.get("tab") as AppTab | null;
        if (requestedTab && ["today", "calendar", "progress", "analysis", "exercises", "clients", "coach", "inbox", "settings"].includes(requestedTab)) setTab(requestedTab);
      });
      remove = () => { listener.remove(); };
    }).catch(() => undefined);
    return () => remove?.();
  }, [setTab]);

  if (authState === "loading" || (authState === "authenticated" && !bootstrapDone) || profile === null || athleteProfile === null) {
    return <div className="loading-screen" role="status">Caricamento account…</div>;
  }
  if (authState === "anonymous") return <AuthGate onAuthenticated={() => setAuthState("authenticated")} />;
  if (passwordSetup) return <AuthGate passwordSetup onAuthenticated={() => { setPasswordSetup(false); setAuthState("authenticated"); }} />;
  if (!account) return <div className="loading-screen" role="status">Preparazione profilo…</div>;
  if (!profile && !isStaff) return <Onboarding />;
  if (!isStaff && athleteProfile?.onboardingCompletedAt && !athleteProfile.consentAcceptedAt) return <ConsentConfirmation />;

  const displayName = getDisplayName(
    account,
    profile,
  );

  return (
    <div className="app-shell">
      <ErrorMonitor />
      <NativeHealthSync enabled={!isStaff} />
      <CloudRefreshManager enabled={!isStaff} onPlanChange={handlePlanChange} />
      <SyncManager />
      <header className="app-header">
        <span className="wordmark">RobertaFunctional</span>
        <span className="cloud-status" title={account?.email ?? "Profilo account"}>
          <UserRound size={17} aria-hidden="true" />
          <span className="user-chip-name">{displayName}</span>
          <i />
        </span>
      </header>
      <main id="main-content" className="main-content">
        {planNotice ? (
          <div className="plan-notice" role="status">
            <div><strong>{planNotice.kind === "assigned" ? "Nuovo piano dal trainer" : "Piano aggiornato"}: {planNotice.planName}</strong>{planNotice.reason ? <p>{planNotice.reason}</p> : null}</div>
            <button type="button" onClick={() => setPlanNotice(null)} aria-label="Chiudi avviso">×</button>
          </div>
        ) : null}
        {tab === "today" ? (!isStaff && !activeAssignment ? <AwaitingPlanScreen /> : <TodayScreen />) : null}
        {tab === "calendar" ? <CalendarScreen /> : null}
        {tab === "progress" ? <ProgressScreen /> : null}
        {tab === "analysis" ? <AnalysisScreen staff={isStaff} admin={account.role === "admin"} /> : null}
        {tab === "exercises" ? (isStaff ? <ExercisesScreen /> : <MySchedeScreen />) : null}
        {tab === "clients" && isStaff ? <ClientsScreen admin={account.role === "admin"} /> : null}
        {tab === "coach" && isStaff ? <CoachScreen /> : null}
        {tab === "inbox" ? <InboxScreen /> : null}
        {tab === "settings" ? <SettingsScreen /> : null}
      </main>
      <nav className="bottom-nav" aria-label="Navigazione principale">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={tab === id ? "is-active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
            <Icon aria-hidden="true" /><span>{label}</span>{id === "inbox" && unreadNotifications ? <strong className="nav-badge" aria-label={`${unreadNotifications} notifiche non lette`}>{unreadNotifications > 9 ? "9+" : unreadNotifications}</strong> : null}
          </button>
        ))}
      </nav>
    </div>
  );
}
