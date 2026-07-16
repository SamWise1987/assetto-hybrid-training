"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Database, Sparkles } from "lucide-react";
import { db, matchExternalWorkout } from "@/lib/db";
import { getRemoteAccessToken } from "@/lib/remote-sync";
import { Button, EmptyState, Surface } from "../ui";
import type { AnalysisSuggestion, ExternalWorkout, RunSession, TrainingPlan, WorkoutSession } from "@/lib/types";

interface StaffClientOption { athlete_user_id: string | null; athlete_email: string; account: { display_name: string } | null }

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
    if (!staff || admin || !selectedAthlete) return;
    getRemoteAccessToken().then(async (token) => {
      if (!token) return;
      const response = await fetch(`/api/analysis/suggestions?userId=${encodeURIComponent(selectedAthlete)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return;
      const body = await response.json() as { suggestions: Array<{ id: string; athlete_user_id: string; title: string; rationale: string; evidence: string[]; proposed_change: Record<string, unknown>; status: import("@/lib/types").SuggestionStatus; created_at: string; reviewed_at: string | null; reviewed_by: string | null }> };
      await db.analysisSuggestions.where("athleteUserId").equals(selectedAthlete).delete();
      await db.analysisSuggestions.bulkPut(body.suggestions.map((item) => ({ id: item.id, athleteUserId: item.athlete_user_id, title: item.title, rationale: item.rationale, evidence: item.evidence, proposedChange: item.proposed_change, status: item.status, createdAt: item.created_at, reviewedAt: item.reviewed_at ?? undefined, reviewedBy: item.reviewed_by ?? undefined })));
    }).catch(() => undefined);
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
    return <div className="screen-stack analysis-screen"><header className="section-heading"><p className="date-label">Governance dei dati</p><h1>Analisi operative</h1><p>Gli amministratori vedono stato account e sincronizzazioni, non allenamenti, limitazioni o suggerimenti individuali.</p></header><Surface><div className="surface-heading"><div><p className="date-label">Privacy per ruolo</p><h2>Dettagli atleta protetti</h2></div><Database /></div><p>Per verificare account, errori e ultimo aggiornamento usa la dashboard Admin. L’analisi del singolo cliente resta disponibile esclusivamente al trainer assegnato.</p></Surface></div>;
  }

  return <div className="screen-stack analysis-screen"><header className="section-heading"><p className="date-label">Dati e decisioni</p><h1>Analisi</h1><p>Riepilogo separato dalle impostazioni, con fonti visibili e suggerimenti controllati dal trainer.</p></header>
    {!staff && message ? <p role="status">{message}</p> : null}
    {staff ? <Surface><div className="surface-heading"><div><p className="date-label">Decisione assistita</p><h2>{editingSuggestionId ? "Modifica il suggerimento" : "Proponi un miglioramento"}</h2></div><Sparkles /></div><label className="field"><span>Cliente</span><select value={selectedAthlete} onChange={(event) => setSelectedAthlete(event.target.value)} disabled={Boolean(editingSuggestionId)}><option value="">Seleziona</option>{clients.map((client) => <option key={client.athlete_user_id ?? client.athlete_email} value={client.athlete_user_id ?? ""}>{client.account?.display_name ?? client.athlete_email}</option>)}</select></label><label className="field"><span>Titolo</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="field"><span>Motivazione visibile al cliente</span><textarea value={rationale} onChange={(event) => setRationale(event.target.value)} /></label><label className="field"><span>Nota da applicare al piano (facoltativa)</span><textarea value={planDescription} onChange={(event) => setPlanDescription(event.target.value)} /></label><label className="field"><span>Variazione durata corse (%)</span><input type="number" min="-30" max="30" value={runDurationPercent} onChange={(event) => setRunDurationPercent(Math.max(-30, Math.min(30, Number(event.target.value))))} /></label><div className="button-row"><Button onClick={submitSuggestion} disabled={!selectedAthlete || title.length < 2 || rationale.length < 3}>{editingSuggestionId ? "Salva modifica" : "Salva proposta"}</Button>{editingSuggestionId ? <Button variant="ghost" onClick={() => { setEditingSuggestionId(null); setTitle(""); setRationale(""); setPlanDescription(""); setRunDurationPercent(0); }}>Annulla modifica</Button> : null}</div>{message ? <p role="status">{message}</p> : null}</Surface> : <div className="data-freshness" role="status"><Database /><div><strong>{healthState?.lastSuccessfulSyncAt ? "Dati Health aggiornati" : "Dati Health non ancora sincronizzati"}</strong><span>{healthState?.lastSuccessfulSyncAt ? new Date(healthState.lastSuccessfulSyncAt).toLocaleString("it-IT") : "Collega il telefono o importa un GPX"}</span></div></div>}
    {!staff ? <Surface><div className="surface-heading"><div><p className="date-label">Qualità e freschezza</p><h2>Fonti dei dati</h2></div><Database /></div>{sourceFreshness.length ? <div className="source-quality-grid">{sourceFreshness.map((item) => <article key={item.source}><strong>{item.source.replaceAll("_", " ")}</strong><span>{item.count} attività · ultimo dato {new Date(item.latest).toLocaleDateString("it-IT")}</span><small>{item.quality}</small></article>)}</div> : <EmptyState title="Nessun dato disponibile" text="Registra un allenamento o collega una fonte esterna." />}</Surface> : null}
    {review ? <Surface><div className="surface-heading"><div><p className="date-label">Riepilogo settimanale</p><h2>{review.summary}</h2></div><Sparkles /></div><ul>{[...review.strengthNotes, ...review.runNotes].map((note) => <li key={note}>{note}</li>)}</ul></Surface> : <EmptyState title="Analisi in preparazione" text="Servono alcuni allenamenti registrati per costruire un riepilogo affidabile." />}
    <Surface><div className="surface-heading"><div><p className="date-label">Proposte</p><h2>Suggerimenti del trainer</h2></div><CheckCircle2 /></div>{suggestions.filter((item) => !staff || item.athleteUserId === selectedAthlete).length ? <div className="suggestion-list">{suggestions.filter((item) => !staff || item.athleteUserId === selectedAthlete).map((item) => <article key={item.id}><span className="decision-action">{item.status}</span><h3>{item.title}</h3><p>{item.rationale}</p>{typeof item.proposedChange.runDurationPercent === "number" ? <small>Durata corse: {item.proposedChange.runDurationPercent > 0 ? "+" : ""}{item.proposedChange.runDurationPercent}%</small> : null}{typeof item.proposedChange.planDescription === "string" ? <small>Nota piano: {item.proposedChange.planDescription}</small> : null}{staff && (item.status === "proposed" || item.status === "modified") ? <div className="button-row"><Button variant="ghost" onClick={() => reviewSuggestion(item.id, "approved")}>Approva</Button><Button variant="ghost" onClick={() => editSuggestion(item)}>Modifica</Button><Button variant="ghost" onClick={() => reviewSuggestion(item.id, "rejected")}>Rifiuta</Button></div> : staff && item.status === "approved" ? <div className="button-row"><Button onClick={() => reviewSuggestion(item.id, "applied")}>Applica al piano</Button><Button variant="ghost" onClick={() => editSuggestion(item)}>Modifica</Button><Button variant="ghost" onClick={() => reviewSuggestion(item.id, "rejected")}>Rifiuta</Button></div> : staff && item.status === "applied" ? <Button variant="ghost" onClick={() => reviewSuggestion(item.id, "undone")}>Annulla e ripristina piano</Button> : !staff && item.status === "proposed" ? <Button variant="ghost" disabled>In attesa del trainer</Button> : null}</article>)}</div> : <EmptyState title="Nessun suggerimento" text="Le modifiche strutturali compariranno qui dopo la revisione del trainer." />}</Surface>
    {!staff ? <Surface><div className="surface-heading"><div><p className="date-label">Fonti recenti</p><h2>Attività sincronizzate</h2></div><Activity /></div>{external.length ? <div className="history-list">{external.map((workout) => <article key={workout.id}><div><strong>{workout.kind === "strength" ? "Allenamento di forza" : workout.kind === "run" ? "Corsa" : "Camminata"}</strong><span>{workout.durationMinutes} min</span></div><p>{workout.sourceName ?? workout.source} · {new Date(workout.startDate).toLocaleDateString("it-IT")}</p>{workout.kind === "strength" && !workout.matchedTemplateId ? <label className="field compact-field"><span>Associa alla scheda prevista</span><select defaultValue="" onChange={(event) => matchWorkout(workout.id, event.target.value)}><option value="">Scegli una scheda</option>{strengthSessions.map((session) => <option key={session.templateId} value={session.templateId}>{session.displayName}</option>)}</select></label> : <small>{workout.matchedTemplateId ? "Associato alla scheda" : "Importato"}</small>}</article>)}</div> : <EmptyState title="Nessuna attività esterna" text="Le attività Apple Health, Health Connect e GPX appariranno qui." />}</Surface> : null}
  </div>;
}
