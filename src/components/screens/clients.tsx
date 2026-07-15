"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, MailPlus, RefreshCw, UserRound, Users } from "lucide-react";
import { getRemoteAccessToken } from "@/lib/remote-sync";
import type { UserRole } from "@/lib/types";
import { Button, EmptyState, Field, Surface } from "../ui";

const DAYS = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

interface ClientSummary {
  id: string;
  trainer_user_id: string;
  athlete_email: string;
  status: "invited" | "active" | "archived";
  invited_at: string;
  account: { user_id: string; display_name: string; email: string } | null;
  profile: { primary_goal: string; onboarding_completed_at: string | null } | null;
  health: { status: string; platform: string; last_successful_sync_at: string | null } | null;
}

interface StaffUser { user_id: string; email: string; display_name: string; role: UserRole }
interface AuditEvent { id: string; action: string; entity_type: string; created_at: string }
interface ErrorEventSummary { id: string; subsystem: string; severity: string; message: string; platform: string; created_at: string }
interface ClientDetail {
  profile: { primary_goal: string; training_days: number[]; equipment: string[]; limitations: string[] } | null;
  health: Array<{ platform: string; status: string; last_successful_sync_at: string | null }>;
  plan: { id: string; name: string; sessions: Array<{ templateId: string; displayName: string; kind: string; dayOfWeek: number }> } | null;
  metrics: { workouts: number; runs: number; followUps: number; matchedExternal?: number; adherence: number; windowDays?: number };
  calendar: Array<{ id: string; date: string; kind: string; status: string; source: string; label: string }>;
  external: Array<{ id: string; kind: string; start_date: string; duration_minutes: number; source: string }>;
}

export function ClientsScreen({ admin = false }: { admin?: boolean }) {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [trainerEmail, setTrainerEmail] = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [roleEmail, setRoleEmail] = useState("");
  const [roleValue, setRoleValue] = useState<UserRole>("coach");
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [errorEvents, setErrorEvents] = useState<ErrorEventSummary[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientSummary | null>(null);
  const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null);

  const load = useCallback(async () => {
    const token = await getRemoteAccessToken();
    if (!token) return;
    const response = await fetch("/api/staff/clients", { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return;
    const body = await response.json() as { clients: ClientSummary[] };
    setClients(body.clients ?? []);
    if (admin) {
      const usersResponse = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
      if (usersResponse.ok) {
        const usersBody = await usersResponse.json() as { users: StaffUser[] };
        setStaffUsers(usersBody.users ?? []);
      }
      const auditResponse = await fetch("/api/admin/audit", { headers: { Authorization: `Bearer ${token}` } });
      if (auditResponse.ok) {
        const auditBody = await auditResponse.json() as { events: AuditEvent[] };
        setAuditEvents(auditBody.events ?? []);
      }
      const errorsResponse = await fetch("/api/admin/errors", { headers: { Authorization: `Bearer ${token}` } });
      if (errorsResponse.ok) {
        const errorsBody = await errorsResponse.json() as { events: ErrorEventSummary[] };
        setErrorEvents(errorsBody.events ?? []);
      }
    }
  }, [admin]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { load().catch(() => undefined); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const invite = async () => {
    setBusy(true);
    setStatus("");
    try {
      const token = await getRemoteAccessToken();
      if (!token) throw new Error("Accesso richiesto.");
      const response = await fetch("/api/staff/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, displayName: name || undefined }),
      });
      const body = await response.json() as { error?: string; alreadyRegistered?: boolean };
      if (!response.ok) throw new Error(body.error ?? "Invito non riuscito.");
      setEmail(""); setName("");
      setStatus(body.alreadyRegistered ? "Cliente già registrato e associato." : "Invito inviato al cliente.");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Invito non riuscito.");
    } finally { setBusy(false); }
  };

  const inviteTrainer = async () => {
    setBusy(true); setStatus("");
    try {
      const token = await getRemoteAccessToken(); if (!token) throw new Error("Accesso richiesto.");
      const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ email: trainerEmail, displayName: trainerName || undefined, role: "coach" }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Invito trainer non riuscito.");
      setTrainerEmail(""); setTrainerName(""); setStatus("Invito trainer inviato."); await load();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Invito non riuscito."); }
    finally { setBusy(false); }
  };

  const assignTrainer = async (relationshipId: string, trainerUserId: string) => {
    const token = await getRemoteAccessToken(); if (!token || !trainerUserId) return;
    const response = await fetch("/api/staff/clients", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ relationshipId, trainerUserId }) });
    if (response.ok) { setStatus("Cliente riassegnato."); await load(); }
  };

  const updateRole = async () => {
    if (!roleEmail.includes("@")) return;
    setBusy(true); setStatus("");
    try {
      const token = await getRemoteAccessToken(); if (!token) throw new Error("Accesso richiesto.");
      const response = await fetch("/api/admin/roles", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ email: roleEmail, role: roleValue }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Aggiornamento ruolo non riuscito.");
      setRoleEmail(""); setStatus(`Ruolo ${roleValue} aggiornato.`); await load();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Aggiornamento ruolo non riuscito."); }
    finally { setBusy(false); }
  };

  const openClient = async (client: ClientSummary) => {
    if (!client.account?.user_id) return;
    setSelectedClient(client); setClientDetail(null);
    const token = await getRemoteAccessToken(); if (!token) return;
    const response = await fetch(`/api/staff/clients/${encodeURIComponent(client.account.user_id)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) { setStatus("Dettaglio cliente non disponibile."); return; }
    setClientDetail(await response.json() as ClientDetail);
  };

  return (
    <div className="screen-stack staff-dashboard">
      <header className="section-heading"><p className="date-label">{admin ? "Dashboard admin" : "Dashboard trainer"}</p><h1>Clienti</h1><p>Inviti, onboarding, piano e sincronizzazione Health in un solo posto.</p></header>
      <div className="dashboard-metrics">
        <div><strong>{clients.filter((client) => client.status === "active").length}</strong><span>Clienti attivi</span></div>
        <div><strong>{clients.filter((client) => client.status === "invited").length}</strong><span>Inviti in attesa</span></div>
        <div><strong>{clients.filter((client) => client.health?.status === "success").length}</strong><span>Health sincronizzato</span></div>
      </div>
      {admin ? <Surface><div className="surface-heading"><div><p className="date-label">Amministrazione</p><h2>Invita un trainer</h2></div><MailPlus /></div><div className="dashboard-form"><Field label="Nome trainer" value={trainerName} onChange={(event) => setTrainerName(event.target.value)} /><Field label="Email trainer" type="email" value={trainerEmail} onChange={(event) => setTrainerEmail(event.target.value)} /></div><Button onClick={inviteTrainer} disabled={busy || !trainerEmail.includes("@")}>Invita trainer</Button><p className="supporting-copy">{staffUsers.filter((user) => user.role === "coach").length} trainer registrati nella struttura.</p></Surface> : null}
      {admin ? <Surface><div className="surface-heading"><div><p className="date-label">Permessi account</p><h2>Gestione ruoli</h2></div><Users /></div><div className="dashboard-form"><Field label="Email utente" type="email" value={roleEmail} onChange={(event) => setRoleEmail(event.target.value)} /><label className="field"><span>Ruolo</span><select value={roleValue} onChange={(event) => setRoleValue(event.target.value as UserRole)}><option value="coach">Trainer</option><option value="athlete">Cliente</option><option value="admin">Admin</option></select></label></div><Button variant="secondary" onClick={updateRole} disabled={busy || !roleEmail.includes("@")}>Aggiorna ruolo</Button><p className="supporting-copy">Gli inviti restano separati: qui modifichi soltanto account già registrati.</p></Surface> : null}
      <Surface>
        <div className="surface-heading"><div><p className="date-label">Nuovo cliente</p><h2>Invia un invito</h2></div><MailPlus /></div>
        <div className="dashboard-form"><Field label="Nome" value={name} onChange={(event) => setName(event.target.value)} /><Field label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <Button onClick={invite} disabled={busy || !email.includes("@")}>{busy ? "Invio…" : "Invita cliente"}</Button>
        {status ? <p className="success-message" role="status">{status}</p> : null}
      </Surface>
      <Surface>
        <div className="surface-heading"><div><p className="date-label">Portafoglio</p><h2>Stato clienti</h2></div><Users /></div>
        {clients.length ? <div className="client-table" role="table" aria-label="Clienti assegnati">
          {clients.map((client) => <article key={client.id} className="client-row" role="row">
            <div className="client-identity"><UserRound /><div><strong>{client.account?.display_name || client.athlete_email}</strong><span>{client.athlete_email}</span></div></div>
            <span className={`role-chip ${client.status === "active" ? "role-athlete" : "role-admin"}`}>{client.status === "active" ? "Attivo" : "Invitato"}</span>
            <div><small>Obiettivo</small><strong>{client.profile?.primary_goal ?? "Onboarding in attesa"}</strong></div>
            <div><small>Health</small><strong className="health-cell"><Activity /> {client.health?.last_successful_sync_at ? new Date(client.health.last_successful_sync_at).toLocaleDateString("it-IT") : "Non collegato"}</strong></div>
            {!admin && client.account ? <Button variant="ghost" onClick={() => openClient(client)}>Apri dettaglio</Button> : null}
            {admin ? <label className="field compact-field"><span>Trainer</span><select defaultValue={client.trainer_user_id} onChange={(event) => assignTrainer(client.id, event.target.value)}><option value="">Assegna</option>{staffUsers.filter((user) => user.role === "coach").map((trainer) => <option key={trainer.user_id} value={trainer.user_id}>{trainer.display_name || trainer.email}</option>)}</select></label> : null}
          </article>)}
        </div> : <EmptyState title="Nessun cliente" text="Invita il primo cliente per iniziare." />}
        <Button variant="ghost" onClick={() => load()}><RefreshCw /> Aggiorna elenco</Button>
      </Surface>
      {!admin && selectedClient ? <Surface><div className="surface-heading"><div><p className="date-label">Dettaglio atleta</p><h2>{selectedClient.account?.display_name ?? selectedClient.athlete_email}</h2></div><UserRound /></div>{clientDetail ? <><div className="dashboard-metrics"><div><strong>{clientDetail.metrics.adherence}%</strong><span>Aderenza · 28 gg</span></div><div><strong>{clientDetail.metrics.workouts}</strong><span>Forza · 28 gg</span></div><div><strong>{clientDetail.metrics.runs}</strong><span>Corse · 28 gg</span></div><div><strong>{clientDetail.metrics.followUps}</strong><span>Risposte · 28 gg</span></div></div><div className="client-detail-grid"><article><small>Piano attivo</small><strong>{clientDetail.plan?.name ?? "Non assegnato"}</strong>{clientDetail.plan?.sessions.slice(0, 6).map((session) => <span key={session.templateId}>{DAYS[session.dayOfWeek]} · {session.displayName}</span>)}</article><article><small>Ultimo sync</small><strong>{clientDetail.health[0]?.last_successful_sync_at ? new Date(clientDetail.health[0].last_successful_sync_at).toLocaleString("it-IT") : "Health non collegato"}</strong><span>{clientDetail.health.map((item) => `${item.platform}: ${item.status}`).join(" · ")}</span></article><article><small>Profilo</small><strong>{clientDetail.profile?.primary_goal ?? "Onboarding incompleto"}</strong><span>{clientDetail.profile?.equipment.join(", ") || "Attrezzatura non indicata"}</span></article></div><h3>Calendario e attività recente</h3>{clientDetail.calendar.length ? <div className="history-list">{clientDetail.calendar.slice(0, 12).map((activity) => <article key={`${activity.kind}-${activity.id}`}><div><strong>{activity.label}</strong><span>{new Date(`${activity.date}T12:00:00`).toLocaleDateString("it-IT")}</span></div><p>{activity.kind} · {activity.source} · {activity.status}</p></article>)}</div> : <EmptyState title="Nessuna attività" text="Le sessioni registrate appariranno qui." />}</> : <p role="status">Caricamento attività…</p>}</Surface> : null}
      {admin ? <Surface><div className="surface-heading"><div><p className="date-label">Controllo struttura</p><h2>Audit log</h2></div><RefreshCw /></div>{auditEvents.length ? <div className="history-list">{auditEvents.slice(0, 20).map((event) => <article key={event.id}><div><strong>{event.action.replaceAll("_", " ")}</strong><span>{new Date(event.created_at).toLocaleString("it-IT")}</span></div><p>{event.entity_type}</p></article>)}</div> : <EmptyState title="Nessun evento" text="Inviti, assegnazioni e modifiche ai piani compariranno qui." />}</Surface> : null}
      {admin ? <Surface><div className="surface-heading"><div><p className="date-label">Monitoraggio</p><h2>Errori app e sincronizzazione</h2></div><Activity /></div>{errorEvents.length ? <div className="history-list">{errorEvents.slice(0, 20).map((event) => <article key={event.id}><div><strong>{event.subsystem} · {event.severity}</strong><span>{new Date(event.created_at).toLocaleString("it-IT")}</span></div><p>{event.platform} · {event.message}</p></article>)}</div> : <EmptyState title="Nessun errore registrato" text="API, sync, Health, push e UI vengono monitorati qui." />}</Surface> : null}
    </div>
  );
}
