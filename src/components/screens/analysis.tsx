"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Database, Sparkles } from "lucide-react";
import { db, matchExternalWorkout } from "@/lib/db";
import { getRemoteAccessToken } from "@/lib/remote-sync";
import { buildTrainerSourceFreshness } from "@/lib/trainer-analysis-summary";
import { Button, EmptyState, Surface } from "../ui";
import type { AnalysisSuggestion, ExternalWorkout, RunSession, TrainingPlan, WorkoutSession } from "@/lib/types";

interface StaffClientOption { athlete_user_id: string | null; athlete_email: string; account: { display_name: string } | null }
interface TrainerAnalysisSummary {
  profile: { primary_goal: string } | null;
  health: Array<{ platform: string; status: string; last_successful_sync_at: string | null }>;
  metrics: { workouts: number; runs: number; followUps: number; matchedExternal?: number; adherence: number; windowDays?: number };
  calendar: Array<{ id: string; date: string; kind: string; status: string; source: string; label: string }>;
  external: Array<{ id: string; kind: string; source: string; start_date: string }>;
}
interface AdminOperationalData {
  collectedAt: number;
  users: Array<{ user_id: string; role: "admin" | "coach" | "athlete" }>;
  clients: Array<{ id: string; status: "invited" | "active" | "archived"; health: { status: string; last_successful_sync_at: string | null } | null }>;
  plans: Array<{ id: string }>;
  errors: Array<{ id: string; subsystem: string; severity: string; created_at: string }>;
}

export function AnalysisScreen({ staff = false, admin = false }: { staff?: boolean; admin?: boolean }) {
  const review = useLiveQuery(() => admin ? undefined : db.coachReviews.orderBy("date").last(), [admin]);
  const external = useLiveQuery(() => admin ? Promise.resolve([] as ExternalWorkout[]) : db.externalWorkouts.orderBy("startDate").reverse().limit(20).toArray(), [admin], []);
  const workouts = useLiveQuery(() => admin ? Promise.resolve([] as WorkoutSession[]) : db.workoutSessions.orderBy("date").reverse().limit(50).toArray(), [admin], []);
  const runs = useLiveQuery(() => admin ? Promise.resolve([] as RunSession[]) : db.runs.orderBy("date").reverse().limit(50).toArray(), [admin], []);
  const suggestions = useLiveQuery(() => admin ? Promise.resolve([] as AnalysisSuggestion[]) : db.analysisSuggestions.orderBy("createdAt").reverse().toArray(), [admin], []) ?? [];
  const healthState = useLiveQuery(() => admin ? undefined : db.healthSyncStates.toCollection().first(), [admin]);
  const plans = useLiveQuery(() => admin ? Promise.resolve([] as TrainingPlan[]) : db.trainingPlans.toArray(), [admin], []) ?? [];
  const [clients, setClients] = useState<StaffClientOption[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [title, setTitle] = useState("");
  const [rationale, setRationale] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [runDurationPercent, setRunDurationPercent] = useState(0);
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [trainerSummaryResult, setTrainerSummaryResult] = useState<{
    athleteId: string;
    status: "ready" | "error";
    data: TrainerAnalysisSummary | null;
  } | null>(null);
  const [adminOperationalResult, setAdminOperationalResult] = useState<{
    status: "ready" | "error";
    data: AdminOperationalData | null;
  } | null>(null);
  const trainerSummary = trainerSummaryResult?.athleteId === selectedAthlete ? trainerSummaryResult.data : null;
  const trainerSummaryStatus = !selectedAthlete
    ? "idle"
    : trainerSummaryResult?.athleteId === selectedAthlete
      ? trainerSummaryResult.status
      : "loading";

  const sourceFreshness = useMemo(() => {
    const entries = [
      ...workouts.map((item) => ({ source: item.platform === "web" ? "web" : "app", date: item.endedAt ?? `${item.date}T12:00:00`, quality: item.setLogs.length ? "Serie e RIR registrati" : "Riepilogo app" })),
      ...runs.filter((item) => item.source !== "apple_health" && item.source !== "health_connect").map((item) => ({ source: item.source === "gpx" ? "gpx" : item.source === "strava" ? "strava" : item.platform === "web" ? "web" : "app", date: `${item.date}T12:00:00`, quality: item.subjectiveDataAvailable === false ? "Dati oggettivi; RPE non disponibile" : "Dati completi" })),
      ...external.map((item) => ({ source: item.source, date: item.startDate, quality: item.kind === "strength" ? "Riepilogo; nessuna serie inventata" : "Dati dispositivo" })),
    ];
    const grouped = new Map<string, { source: string; count: number; latest: string; quality: string }>();
    for (const entry of entries) {
      const current = grouped.get(entry.source);
      if (!current) grouped.set(entry.source, { source: entry.source, count: 1, latest: entry.date, quality: entry.quality });
      else {
        current.count += 1;
        if (entry.date > current.latest) { current.latest = entry.date; current.quality = entry.quality; }
      }
    }
    return [...grouped.values()].sort((a, b) => b.latest.localeCompare(a.latest));
  }, [external, runs, workouts]);

  const trainerSourceFreshness = useMemo(() => trainerSummary
    ? buildTrainerSourceFreshness({ calendar: trainerSummary.calendar, external: trainerSummary.external })
    : [], [trainerSummary]);

  const adminMetrics = useMemo(() => {
    const data = adminOperationalResult?.data;
    if (!data) return null;
    const staleCutoff = data.collectedAt - 7 * 86_400_000;
    return {
      trainers: data.users.filter((item) => item.role === "coach").length,
      athletes: data.users.filter((item) => item.role === "athlete").length,
      activeClients: data.clients.filter((item) => item.status === "active").length,
      pendingInvites: data.clients.filter((item) => item.status === "invited").length,
      plans: data.plans.length,
      healthConnected: data.clients.filter((item) => item.health?.status === "success").length,
      healthAttention: data.clients.filter((item) => item.health && item.health.status !== "success").length,
      healthStale: data.clients.filter((item) => item.health?.last_successful_sync_at && Date.parse(item.health.last_successful_sync_at) < staleCutoff).length,
      recentErrors: data.errors.filter((item) => Date.parse(item.created_at) >= staleCutoff).length,
    };
  }, [adminOperationalResult]);

  useEffect(() => {
    if (admin) return;
    getRemoteAccessToken().then(async (token) => {
      if (!token) return;
      if (staff) {
        const clientsResponse = await fetch("/api/staff/clients", { headers: { Authorization: `Bearer ${token}` } });
        if (clientsResponse.ok) {
          const clientsBody = await clientsResponse.json() as { clients: StaffClientOption[] };
          const available = clientsBody.clients.filter((item) => item.athlete_user_id);
          setClients(available);
          setSelectedAthlete((current) => current || available[0]?.athlete_user_id || "");
        }
        return;
      }
      const response = await fetch("/api/analysis/suggestions", { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return;
      const body = await response.json() as { suggestions: Array<{ id: string; athlete_user_id: string; title: string; rationale: string; evidence: string[]; proposed_change: Record<string, unknown>; status: import("@/lib/types").SuggestionStatus; created_at: string; reviewed_at: string | null; reviewed_by: string | null }> };
      await db.analysisSuggestions.bulkPut(body.suggestions.map((item) => ({ id: item.id, athleteUserId: item.athlete_user_id, title: item.title, rationale: item.rationale, evidence: item.evidence, proposedChange: item.proposed_change, status: item.status, createdAt: item.created_at, reviewedAt: item.reviewed_at ?? undefined, reviewedBy: item.reviewed_by ?? undefined })));
    }).catch(() => undefined);
  }, [admin, staff]);

  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    getRemoteAccessToken().then(async (token) => {
      if (!token) throw new Error("Accesso richiesto");
      const options = { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal };
      const [usersResponse, clientsResponse, plansResponse, errorsResponse] = await Promise.all([
        fetch("/api/admin/users", options),
        fetch("/api/staff/clients", options),
        fetch("/api/plans", options),
        fetch("/api/admin/errors", options),
      ]);
      if (![usersResponse, clientsResponse, plansResponse, errorsResponse].every((response) => response.ok)) {
        throw new Error("Indicatori amministrativi non disponibili");
      }
      const [usersBody, clientsBody, plansBody, errorsBody] = await Promise.all([
        usersResponse.json() as Promise<{ users: AdminOperationalData["users"] }>,
        clientsResponse.json() as Promise<{ clients: AdminOperationalData["clients"] }>,
        plansResponse.json() as Promise<{ plans: AdminOperationalData["plans"] }>,
        errorsResponse.json() as Promise<{ events: AdminOperationalData["errors"] }>,
      ]);
      if (controller.signal.aborted) return;
      setAdminOperationalResult({
        status: "ready",
        data: { collectedAt: Date.now(), users: usersBody.users, clients: clientsBody.clients, plans: plansBody.plans, errors: errorsBody.events },
      });
    }).catch((error) => {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
      setAdminOperationalResult({ status: "error", data: null });
    });
    return () => controller.abort();
  }, [admin]);

  useEffect(() => {
    if (!staff || admin || !selectedAthlete) return;
    const controller = new AbortController();
    getRemoteAccessToken().then(async (token) => {
      if (!token) throw new Error("Accesso richiesto");
      const headers = { Authorization: `Bearer ${token}` };
      const [suggestionsResponse, summaryResponse] = await Promise.all([
        fetch(`/api/analysis/suggestions?userId=${encodeURIComponent(selectedAthlete)}`, { headers, signal: controller.signal }),
        fetch(`/api/staff/clients/${encodeURIComponent(selectedAthlete)}`, { headers, signal: controller.signal }),
      ]);
      if (!suggestionsResponse.ok || !summaryResponse.ok) throw new Error("Analisi cliente non disponibile");
      const [suggestionsBody, summaryBody] = await Promise.all([
        suggestionsResponse.json() as Promise<{ suggestions: Array<{ id: string; athlete_user_id: string; title: string; rationale: string; evidence: string[]; proposed_change: Record<string, unknown>; status: import("@/lib/types").SuggestionStatus; created_at: string; reviewed_at: string | null; reviewed_by: string | null }> }>,
        summaryResponse.json() as Promise<TrainerAnalysisSummary>,
      ]);
      if (controller.signal.aborted) return;
      await db.analysisSuggestions.where("athleteUserId").equals(selectedAthlete).delete();
      await db.analysisSuggestions.bulkPut(suggestionsBody.suggestions.map((item) => ({ id: item.id, athleteUserId: item.athlete_user_id, title: item.title, rationale: item.rationale, evidence: item.evidence, proposedChange: item.proposed_change, status: item.status, createdAt: item.created_at, reviewedAt: item.reviewed_at ?? undefined, reviewedBy: item.reviewed_by ?? undefined })));
      setTrainerSummaryResult({ athleteId: selectedAthlete, status: "ready", data: summaryBody });
    }).catch((error) => {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
      setTrainerSummaryResult({ athleteId: selectedAthlete, status: "error", data: null });
    });
    return () => controller.abort();
  }, [admin, selectedAthlete, staff]);

  const submitSuggestion = async () => {
    const token = await getRemoteAccessToken();
    if (!token || !selectedAthlete) return;
    const proposedChange = {
      ...(planDescription.trim() ? { planDescription: planDescription.trim() } : {}),
      ...(runDurationPercent ? { runDurationPercent } : {}),
    };
    const response = await fetch("/api/analysis/suggestions", {
      method: editingSuggestionId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(editingSuggestionId
        ? { id: editingSuggestionId, status: "modified", title, rationale, proposedChange }
        : { athleteUserId: selectedAthlete, title, rationale, evidence: [], proposedChange }),
    });
    const body = await response.json() as { suggestion?: { id: string }; error?: string };
    if (!response.ok) { setMessage(body.error ?? "Proposta non salvata."); return; }
    setTitle(""); setRationale(""); setPlanDescription(""); setRunDurationPercent(0); setEditingSuggestionId(null);
    setMessage(editingSuggestionId ? "Suggerimento modificato e salvato." : "Suggerimento proposto e salvato.");
    const refresh = await fetch(`/api/analysis/suggestions?userId=${encodeURIComponent(selectedAthlete)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (refresh.ok) {
      const data = await refresh.json() as { suggestions: Array<{ id: string; athlete_user_id: string; title: string; rationale: string; evidence: string[]; proposed_change: Record<string, unknown>; status: import("@/lib/types").SuggestionStatus; created_at: string }> };
      await db.analysisSuggestions.bulkPut(data.suggestions.map((item) => ({ id: item.id, athleteUserId: item.athlete_user_id, title: item.title, rationale: item.rationale, evidence: item.evidence, proposedChange: item.proposed_change, status: item.status, createdAt: item.created_at })));
    }
  };

  const reviewSuggestion = async (id: string, status: "approved" | "applied" | "rejected" | "undone") => {
    const token = await getRemoteAccessToken(); if (!token) return;
    const response = await fetch("/api/analysis/suggestions", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id, status }) });
    if (!response.ok) return;
    await db.analysisSuggestions.update(id, { status, reviewedAt: new Date().toISOString() });
  };

  const editSuggestion = (item: import("@/lib/types").AnalysisSuggestion) => {
    setEditingSuggestionId(item.id);
    setTitle(item.title);
    setRationale(item.rationale);
    setPlanDescription(typeof item.proposedChange.planDescription === "string" ? item.proposedChange.planDescription : "");
    setRunDurationPercent(typeof item.proposedChange.runDurationPercent === "number" ? item.proposedChange.runDurationPercent : 0);
  };

  const matchWorkout = async (workoutId: string, templateId: string) => {
    if (!templateId) return;
    try {
      await matchExternalWorkout(workoutId, templateId);
      const token = await getRemoteAccessToken();
      if (!token) {
        setMessage("Attività associata sul dispositivo. La sincronizzazione avverrà al prossimo accesso online.");
        return;
      }
      const response = await fetch("/api/external-workouts", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: workoutId, templateId }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      setMessage(response.ok ? "Attività associata alla scheda e sincronizzata." : body.error ?? "Associazione salvata sul dispositivo, ma non ancora sincronizzata.");
    } catch {
      setMessage("Non è stato possibile associare questa attività.");
    }
  };

  const strengthSessions = plans.flatMap((plan) => plan.sessions.filter((session) => session.kind === "strength"));

  if (admin) {
    return <div className="screen-stack analysis-screen"><header className="section-heading"><p className="date-label">Governance dei dati</p><h1>Analisi operative</h1><p>Controlla struttura, adozione e qualità delle sincronizzazioni. I dati sono aggregati: allenamenti, limitazioni e suggerimenti individuali restano protetti.</p></header>{!adminOperationalResult ? <p role="status">Caricamento indicatori della struttura…</p> : adminOperationalResult.status === "error" || !adminMetrics ? <EmptyState title="Indicatori non disponibili" text="Controlla la connessione e riprova dalla dashboard Admin." /> : <><div className="dashboard-metrics"><div><strong>{adminMetrics.trainers}</strong><span>Trainer</span></div><div><strong>{adminMetrics.activeClients}</strong><span>Clienti attivi</span></div><div><strong>{adminMetrics.plans}</strong><span>Piani disponibili</span></div></div><Surface><div className="surface-heading"><div><p className="date-label">Adozione</p><h2>Account e inviti</h2></div><Activity /></div><div className="source-quality-grid"><article><strong>{adminMetrics.athletes} account cliente</strong><span>{adminMetrics.activeClients} relazioni attive</span><small>{adminMetrics.pendingInvites} inviti ancora in attesa</small></article><article><strong>{adminMetrics.trainers} account trainer</strong><span>{adminMetrics.plans} piani nella libreria della struttura</span><small>Ruoli e assegnazioni si gestiscono dalla pagina Clienti</small></article></div></Surface><Surface><div className="surface-heading"><div><p className="date-label">Sincronizzazioni</p><h2>Stato Health aggregato</h2></div><Database /></div><div className="source-quality-grid"><article><strong>{adminMetrics.healthConnected} collegamenti attivi</strong><span>Ultimo sync disponibile per la struttura</span><small>Nessun dettaglio sanitario individuale è mostrato</small></article><article><strong>{adminMetrics.healthAttention} da verificare</strong><span>{adminMetrics.healthStale} senza aggiornamenti negli ultimi 7 giorni</span><small>Il trainer assegnato può aprire il dettaglio del cliente</small></article></div></Surface><Surface><div className="surface-heading"><div><p className="date-label">Affidabilità</p><h2>Errori recenti</h2></div><Activity /></div><p><strong>{adminMetrics.recentErrors}</strong> eventi tecnici negli ultimi 7 giorni. I messaggi sono sanificati e non includono dati sanitari del cliente.</p></Surface></>}</div>;
  }

  return <div className="screen-stack analysis-screen"><header className="section-heading"><p className="date-label">Dati e decisioni</p><h1>Analisi</h1><p>Riepilogo separato dalle impostazioni, con fonti visibili e suggerimenti controllati dal trainer.</p></header>
    {!staff && message ? <p role="status">{message}</p> : null}
    {staff ? <><Surface><div className="surface-heading"><div><p className="date-label">Cliente selezionato</p><h2>Riepilogo prima della decisione</h2></div><Activity /></div>{trainerSummaryStatus === "loading" ? <p role="status">Caricamento dati del cliente…</p> : trainerSummaryStatus === "error" ? <EmptyState title="Analisi non disponibile" text="Controlla la connessione e riprova selezionando il cliente." /> : trainerSummary ? <><div className="dashboard-metrics"><div><strong>{trainerSummary.metrics.adherence}%</strong><span>Aderenza · {trainerSummary.metrics.windowDays ?? 28} gg</span></div><div><strong>{trainerSummary.metrics.workouts}</strong><span>Forza</span></div><div><strong>{trainerSummary.metrics.runs}</strong><span>Corse</span></div><div><strong>{trainerSummary.metrics.followUps}</strong><span>Controlli 24 ore</span></div></div><div className="data-freshness" role="status"><Database /><div><strong>{trainerSummary.health.some((item) => item.last_successful_sync_at) ? "Dati Health sincronizzati" : "Health non ancora sincronizzato"}</strong><span>{trainerSummary.health.map((item) => `${item.platform}: ${item.last_successful_sync_at ? new Date(item.last_successful_sync_at).toLocaleString("it-IT") : item.status}`).join(" · ") || "Nessun collegamento registrato"}</span></div></div>{trainerSourceFreshness.length ? <div className="source-quality-grid">{trainerSourceFreshness.map((item) => <article key={item.source}><strong>{item.source.replaceAll("_", " ")}</strong><span>{item.count} attività · ultimo dato {new Date(item.latestAt).toLocaleDateString("it-IT")}</span><small>{item.quality}</small></article>)}</div> : <EmptyState title="Nessuna attività disponibile" text="Il riepilogo si aggiorna quando il cliente registra o sincronizza un allenamento." />}</> : <EmptyState title="Seleziona un cliente" text="Scegli un cliente per vedere dati e freschezza delle fonti." />}</Surface><Surface><div className="surface-heading"><div><p className="date-label">Decisione assistita</p><h2>{editingSuggestionId ? "Modifica il suggerimento" : "Proponi un miglioramento"}</h2></div><Sparkles /></div><label className="field"><span>Cliente</span><select value={selectedAthlete} onChange={(event) => setSelectedAthlete(event.target.value)} disabled={Boolean(editingSuggestionId)}><option value="">Seleziona</option>{clients.map((client) => <option key={client.athlete_user_id ?? client.athlete_email} value={client.athlete_user_id ?? ""}>{client.account?.display_name ?? client.athlete_email}</option>)}</select></label><label className="field"><span>Titolo</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="field"><span>Motivazione visibile al cliente</span><textarea value={rationale} onChange={(event) => setRationale(event.target.value)} /></label><label className="field"><span>Nota da applicare al piano (facoltativa)</span><textarea value={planDescription} onChange={(event) => setPlanDescription(event.target.value)} /></label><label className="field"><span>Variazione durata corse (%)</span><input type="number" min="-30" max="30" value={runDurationPercent} onChange={(event) => setRunDurationPercent(Math.max(-30, Math.min(30, Number(event.target.value))))} /></label><div className="button-row"><Button onClick={submitSuggestion} disabled={!selectedAthlete || title.length < 2 || rationale.length < 3}>{editingSuggestionId ? "Salva modifica" : "Salva proposta"}</Button>{editingSuggestionId ? <Button variant="ghost" onClick={() => { setEditingSuggestionId(null); setTitle(""); setRationale(""); setPlanDescription(""); setRunDurationPercent(0); }}>Annulla modifica</Button> : null}</div>{message ? <p role="status">{message}</p> : null}</Surface></> : <div className="data-freshness" role="status"><Database /><div><strong>{healthState?.lastSuccessfulSyncAt ? "Dati Health aggiornati" : "Dati Health non ancora sincronizzati"}</strong><span>{healthState?.lastSuccessfulSyncAt ? new Date(healthState.lastSuccessfulSyncAt).toLocaleString("it-IT") : "Collega il telefono o importa un GPX"}</span></div></div>}
    {!staff ? <Surface><div className="surface-heading"><div><p className="date-label">Qualità e freschezza</p><h2>Fonti dei dati</h2></div><Database /></div>{sourceFreshness.length ? <div className="source-quality-grid">{sourceFreshness.map((item) => <article key={item.source}><strong>{item.source.replaceAll("_", " ")}</strong><span>{item.count} attività · ultimo dato {new Date(item.latest).toLocaleDateString("it-IT")}</span><small>{item.quality}</small></article>)}</div> : <EmptyState title="Nessun dato disponibile" text="Registra un allenamento o collega una fonte esterna." />}</Surface> : null}
    {!staff ? review ? <Surface><div className="surface-heading"><div><p className="date-label">Riepilogo settimanale</p><h2>{review.summary}</h2></div><Sparkles /></div><ul>{[...review.strengthNotes, ...review.runNotes].map((note) => <li key={note}>{note}</li>)}</ul></Surface> : <EmptyState title="Analisi in preparazione" text="Servono alcuni allenamenti registrati per costruire un riepilogo affidabile." /> : null}
    <Surface><div className="surface-heading"><div><p className="date-label">Proposte</p><h2>Suggerimenti del trainer</h2></div><CheckCircle2 /></div>{suggestions.filter((item) => !staff || item.athleteUserId === selectedAthlete).length ? <div className="suggestion-list">{suggestions.filter((item) => !staff || item.athleteUserId === selectedAthlete).map((item) => <article key={item.id}><span className="decision-action">{item.status}</span><h3>{item.title}</h3><p>{item.rationale}</p>{typeof item.proposedChange.runDurationPercent === "number" ? <small>Durata corse: {item.proposedChange.runDurationPercent > 0 ? "+" : ""}{item.proposedChange.runDurationPercent}%</small> : null}{typeof item.proposedChange.planDescription === "string" ? <small>Nota piano: {item.proposedChange.planDescription}</small> : null}{staff && (item.status === "proposed" || item.status === "modified") ? <div className="button-row"><Button variant="ghost" onClick={() => reviewSuggestion(item.id, "approved")}>Approva</Button><Button variant="ghost" onClick={() => editSuggestion(item)}>Modifica</Button><Button variant="ghost" onClick={() => reviewSuggestion(item.id, "rejected")}>Rifiuta</Button></div> : staff && item.status === "approved" ? <div className="button-row"><Button onClick={() => reviewSuggestion(item.id, "applied")}>Applica al piano</Button><Button variant="ghost" onClick={() => editSuggestion(item)}>Modifica</Button><Button variant="ghost" onClick={() => reviewSuggestion(item.id, "rejected")}>Rifiuta</Button></div> : staff && item.status === "applied" ? <Button variant="ghost" onClick={() => reviewSuggestion(item.id, "undone")}>Annulla e ripristina piano</Button> : !staff && item.status === "proposed" ? <Button variant="ghost" disabled>In attesa del trainer</Button> : null}</article>)}</div> : <EmptyState title="Nessun suggerimento" text="Le modifiche strutturali compariranno qui dopo la revisione del trainer." />}</Surface>
    {!staff ? <Surface><div className="surface-heading"><div><p className="date-label">Fonti recenti</p><h2>Attività sincronizzate</h2></div><Activity /></div>{external.length ? <div className="history-list">{external.map((workout) => <article key={workout.id}><div><strong>{workout.kind === "strength" ? "Allenamento di forza" : workout.kind === "run" ? "Corsa" : "Camminata"}</strong><span>{workout.durationMinutes} min</span></div><p>{workout.sourceName ?? workout.source} · {new Date(workout.startDate).toLocaleDateString("it-IT")}</p>{workout.kind === "strength" && !workout.matchedTemplateId ? <label className="field compact-field"><span>Associa alla scheda prevista</span><select defaultValue="" onChange={(event) => matchWorkout(workout.id, event.target.value)}><option value="">Scegli una scheda</option>{strengthSessions.map((session) => <option key={session.templateId} value={session.templateId}>{session.displayName}</option>)}</select></label> : <small>{workout.matchedTemplateId ? "Associato alla scheda" : "Importato"}</small>}</article>)}</div> : <EmptyState title="Nessuna attività esterna" text="Le attività Apple Health, Health Connect e GPX appariranno qui." />}</Surface> : null}
  </div>;
}
