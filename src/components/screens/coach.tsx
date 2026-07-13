"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { ClipboardList, Save, Send, UserPlus, UserRoundCog, Users } from "lucide-react";
import { assignPlanLocally, applyCoachRunPlans, db, getResolvedTemplates, saveTrainingPlan } from "@/lib/db";
import { defaultTrainingPlan } from "@/lib/plans";
import { canManagePlans } from "@/lib/roles";
import { getRemoteAccessToken, syncAccountProfile } from "@/lib/remote-sync";
import { EXERCISES, TEMPLATES } from "@/lib/program";
import type { ExercisePrescription, RunSession, TrainingPlan, TrainingPlanSession, UserRole } from "@/lib/types";
import { Button, Field, Surface } from "../ui";

const DAYS = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

function enrichSessions(planSessions: TrainingPlanSession[]): TrainingPlanSession[] {
  return planSessions.map((session) => {
    if (session.prescriptions?.length || session.runConfig) return session;
    const template = TEMPLATES.find((entry) => entry.id === session.templateId);
    if (!template) return session;
    if (template.kind === "run") {
      return {
        ...session,
        runConfig: {
          type: template.id === "main-run" ? "long-easy" : "easy",
          durationMinutes: session.estimatedMinutes,
          notes: session.notes,
        },
      };
    }
    if (template.kind === "strength") {
      return { ...session, prescriptions: template.prescriptions };
    }
    return session;
  });
}

function sessionsToRunSessions(sessions: TrainingPlanSession[]) {
  return sessions
    .filter((session) => session.runConfig)
    .map((session) => ({
      dayOfWeek: session.dayOfWeek,
      type: session.runConfig!.type,
      durationMinutes: session.runConfig!.durationMinutes,
      notes: session.runConfig!.notes,
    }));
}

interface StaffUser {
  user_id: string;
  email: string;
  display_name: string;
  role: UserRole;
  created_at: string;
}

export function CoachScreen() {
  const account = useLiveQuery(() => db.accountProfiles.toCollection().first());
  const localPlans = useLiveQuery(() => db.trainingPlans.orderBy("updatedAt").reverse().toArray()) ?? [];
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [sessions, setSessions] = useState<TrainingPlanSession[]>([]);
  const [planName, setPlanName] = useState("Piano personalizzato");
  const [assignEmail, setAssignEmail] = useState("");
  const [status, setStatus] = useState("");
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [trainerEmail, setTrainerEmail] = useState("");
  const [trainerPassword, setTrainerPassword] = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [roleEmail, setRoleEmail] = useState("");
  const [roleValue, setRoleValue] = useState<UserRole>("coach");

  const resolvedTemplates = useLiveQuery(() => getResolvedTemplates(), [], []);

  useEffect(() => {
    syncAccountProfile().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (account?.role !== "admin") return;
    getRemoteAccessToken()
      .then(async (token) => {
        if (!token) return;
        const response = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) return;
        const body = (await response.json()) as { users: StaffUser[] };
        setStaffUsers(body.users ?? []);
      })
      .catch(() => undefined);
  }, [account?.role, status]);

  useEffect(() => {
    const plan = localPlans.find((entry) => entry.id === selectedPlanId) ?? localPlans[0];
    if (!plan) {
      const fallback = defaultTrainingPlan(account?.userId ?? "local");
      // Sync local editor state when Dexie plans load or selection changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional form reset from live query
      setSelectedPlanId(fallback.id);
      setPlanName(fallback.name);
      setSessions(enrichSessions(fallback.sessions));
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional form reset from live query
    setSelectedPlanId(plan.id);
    setPlanName(plan.name);
    setSessions(enrichSessions(plan.sessions));
  }, [localPlans, selectedPlanId, account?.userId]);

  if (!canManagePlans(account?.role)) {
    return (
      <div className="screen-stack">
        <header className="section-heading">
          <p className="date-label">Area riservata</p>
          <h1>Studio coach</h1>
          <p>Accedi con le credenziali del trainer o dell&apos;amministratore per creare e assegnare piani di allenamento.</p>
        </header>
      </div>
    );
  }

  const updateSessionName = (templateId: string, displayName: string) => {
    setSessions(sessions.map((session) => (session.templateId === templateId ? { ...session, displayName } : session)));
  };

  const updatePrescription = (
    templateId: string,
    prescriptionId: string,
    patch: Partial<ExercisePrescription>,
  ) => {
    setSessions(
      sessions.map((session) => {
        if (session.templateId !== templateId || !session.prescriptions) return session;
        return {
          ...session,
          prescriptions: session.prescriptions.map((prescription) =>
            prescription.id === prescriptionId ? { ...prescription, ...patch } : prescription,
          ),
        };
      }),
    );
  };

  const updateRunConfig = (
    templateId: string,
    patch: Partial<NonNullable<TrainingPlanSession["runConfig"]>>,
  ) => {
    setSessions(
      sessions.map((session) => {
        if (session.templateId !== templateId) return session;
        const runConfig = session.runConfig ?? {
          type: "easy" as const,
          durationMinutes: session.estimatedMinutes,
        };
        return {
          ...session,
          runConfig: { ...runConfig, ...patch },
          estimatedMinutes: patch.durationMinutes ?? session.estimatedMinutes,
        };
      }),
    );
  };

  const promoteRole = async () => {
    if (!roleEmail.includes("@")) {
      setStatus("Inserisci un'email valida.");
      return;
    }
    const token = await getRemoteAccessToken();
    if (!token) return;
    const response = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: roleEmail, role: roleValue }),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => ({ error: "Aggiornamento fallito" }))) as { error?: string };
      setStatus(error.error ?? "Aggiornamento ruolo fallito.");
      return;
    }
    setRoleEmail("");
    setStatus(`Ruolo ${roleValue} assegnato a ${roleEmail}.`);
  };

  const savePlan = async () => {
    const plan: TrainingPlan = {
      id: selectedPlanId || `plan-${Date.now()}`,
      name: planName,
      description: "Piano modificato dallo staff",
      sessions,
      runSessions: sessionsToRunSessions(sessions),
      createdBy: account?.userId ?? "local-staff",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const token = await getRemoteAccessToken();
    if (token) {
      const isCloudId = /^[0-9a-f-]{36}$/i.test(plan.id);
      const method = isCloudId ? "PATCH" : "POST";
      const url = method === "PATCH" ? `/api/plans/${plan.id}` : "/api/plans";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: plan.name, sessions: plan.sessions, description: plan.description }),
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => ({ error: "Salvataggio fallito" }))) as { error?: string };
        setStatus(error.error ?? "Salvataggio fallito.");
        return;
      }
      const body = (await response.json()) as { plan: TrainingPlan };
      await saveTrainingPlan(body.plan);
      if (body.plan.runSessions?.length) await applyCoachRunPlans(body.plan.runSessions);
      setSelectedPlanId(body.plan.id);
      setStatus("Piano salvato.");
      return;
    }

    await saveTrainingPlan(plan);
    if (plan.runSessions?.length) await applyCoachRunPlans(plan.runSessions);
    setSelectedPlanId(plan.id);
    setStatus("Piano salvato.");
  };

  const assignPlan = async () => {
    if (!assignEmail.includes("@")) {
      setStatus("Inserisci l'email dell'atleta.");
      return;
    }
    const token = await getRemoteAccessToken();
    if (!token) {
      setStatus("Per assegnare serve l'accesso con account.");
      return;
    }
    const response = await fetch(`/api/plans/${selectedPlanId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ athleteEmail: assignEmail }),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => ({ error: "Assegnazione fallita" }))) as { error?: string };
      setStatus(error.error ?? "Assegnazione fallita.");
      return;
    }
    const body = (await response.json()) as {
      assignment: { id: string; planId: string; athleteEmail: string; assignedBy: string; assignedAt: string; active: boolean };
      plan: TrainingPlan | null;
    };
    await assignPlanLocally({
      id: body.assignment.id,
      planId: body.assignment.planId,
      athleteEmail: body.assignment.athleteEmail,
      assignedBy: body.assignment.assignedBy,
      assignedAt: body.assignment.assignedAt,
      active: body.assignment.active,
    });
    if (body.plan) {
      await saveTrainingPlan(body.plan);
      if (body.plan.runSessions?.length) await applyCoachRunPlans(body.plan.runSessions);
    }
    setStatus(`Piano assegnato a ${assignEmail}.`);
  };

  const createTrainer = async () => {
    if (!trainerEmail.includes("@") || trainerPassword.length < 8) {
      setStatus("Inserisci email e password (minimo 8 caratteri).");
      return;
    }
    const token = await getRemoteAccessToken();
    if (!token) {
      setStatus("Accesso amministratore richiesto.");
      return;
    }
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        email: trainerEmail,
        password: trainerPassword,
        role: "coach",
        displayName: trainerName || undefined,
      }),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => ({ error: "Creazione fallita" }))) as { error?: string };
      setStatus(error.error ?? "Creazione account fallita.");
      return;
    }
    setTrainerEmail("");
    setTrainerPassword("");
    setTrainerName("");
    setStatus(`Trainer ${trainerEmail} creato. Può accedere con email e password.`);
  };

  const coaches = staffUsers.filter((user) => user.role === "coach" || user.role === "admin");

  return (
    <div className="screen-stack">
      <header className="section-heading">
        <p className="date-label">{account?.role === "admin" ? "Amministratore" : "Trainer"}{account?.email ? ` · ${account.email}` : ""}</p>
        <h1>Studio piani</h1>
        <p>Crea schede personalizzate e assegnale ai tuoi clienti.</p>
      </header>

      {account?.role === "admin" ? (
        <Surface>
          <div className="surface-heading">
            <div><p className="date-label">Team</p><h2>Gestione trainer</h2></div>
            <Users />
          </div>
          <p>Crea account per i trainer che potranno accedere e costruire schede per i clienti.</p>
          <Field label="Nome trainer" value={trainerName} onChange={(e) => setTrainerName(e.target.value)} />
          <Field label="Email trainer" type="email" value={trainerEmail} onChange={(e) => setTrainerEmail(e.target.value)} />
          <Field label="Password" type="password" value={trainerPassword} onChange={(e) => setTrainerPassword(e.target.value)} hint="Minimo 8 caratteri" />
          <Button onClick={createTrainer}><UserPlus /> Crea account trainer</Button>
          {coaches.length ? (
            <div className="staff-list">
              <p className="date-label">Account attivi</p>
              {coaches.map((user) => (
                <div key={user.user_id} className="staff-row">
                  <div>
                    <strong>{user.display_name || user.email}</strong>
                    <span>{user.email}</span>
                  </div>
                  <span className={`role-chip role-${user.role}`}>{user.role === "admin" ? "Admin" : "Trainer"}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="role-promote">
            <p className="date-label">Cambia ruolo utente</p>
            <Field label="Email utente" type="email" value={roleEmail} onChange={(e) => setRoleEmail(e.target.value)} />
            <label className="field">
              <span>Ruolo</span>
              <select value={roleValue} onChange={(e) => setRoleValue(e.target.value as UserRole)}>
                <option value="coach">Trainer</option>
                <option value="athlete">Atleta</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <Button variant="secondary" onClick={promoteRole}>Aggiorna ruolo</Button>
          </div>
        </Surface>
      ) : null}

      <Surface>
        <div className="surface-heading">
          <div><p className="date-label">Piano attivo</p><h2>Nome e sessioni</h2></div>
          <ClipboardList />
        </div>
        <Field label="Nome piano" value={planName} onChange={(e) => setPlanName(e.target.value)} />
        <div className="week-list">
          {sessions.map((session) => (
            <article key={session.templateId}>
              <div>
                <span>{DAYS[session.dayOfWeek]}</span>
                <Field
                  label={`Allenamento (${session.kind})`}
                  value={session.displayName}
                  onChange={(e) => updateSessionName(session.templateId, e.target.value)}
                />
                {session.kind === "strength" || session.kind === "run" ? (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setExpandedSession(expandedSession === session.templateId ? null : session.templateId)
                    }
                  >
                    {expandedSession === session.templateId ? "Chiudi dettagli" : "Modifica esercizi / corsa"}
                  </Button>
                ) : null}
                {expandedSession === session.templateId && session.kind === "strength" && session.prescriptions ? (
                  <div className="prescription-editor">
                    {session.prescriptions.map((prescription) => {
                      const exercise = EXERCISES.find((entry) => entry.id === prescription.exerciseId);
                      return (
                        <div key={prescription.id} className="prescription-row">
                          <label className="field">
                            <span>Esercizio</span>
                            <select
                              value={prescription.exerciseId}
                              onChange={(e) =>
                                updatePrescription(session.templateId, prescription.id, {
                                  exerciseId: e.target.value,
                                })
                              }
                            >
                              {EXERCISES.map((entry) => (
                                <option key={entry.id} value={entry.id}>{entry.name}</option>
                              ))}
                            </select>
                          </label>
                          <div className="two-column">
                            <Field
                              label="Serie"
                              type="number"
                              value={prescription.sets}
                              onChange={(e) =>
                                updatePrescription(session.templateId, prescription.id, {
                                  sets: Number(e.target.value),
                                })
                              }
                            />
                            <Field
                              label="Rep min"
                              type="number"
                              value={prescription.repRange?.[0] ?? 8}
                              onChange={(e) =>
                                updatePrescription(session.templateId, prescription.id, {
                                  repRange: [Number(e.target.value), prescription.repRange?.[1] ?? 12],
                                })
                              }
                            />
                            <Field
                              label="Rep max"
                              type="number"
                              value={prescription.repRange?.[1] ?? 12}
                              onChange={(e) =>
                                updatePrescription(session.templateId, prescription.id, {
                                  repRange: [prescription.repRange?.[0] ?? 8, Number(e.target.value)],
                                })
                              }
                            />
                          </div>
                          <p className="quiet-note">{exercise?.pattern ?? "pattern"} · RIR {prescription.targetRir.join("–")}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {expandedSession === session.templateId && session.kind === "run" && session.runConfig ? (
                  <div className="prescription-editor">
                    <label className="field">
                      <span>Tipo corsa</span>
                      <select
                        value={session.runConfig.type}
                        onChange={(e) =>
                          updateRunConfig(session.templateId, {
                            type: e.target.value as RunSession["type"],
                          })
                        }
                      >
                        <option value="easy">Facile</option>
                        <option value="long-easy">Lunga facile</option>
                        <option value="controlled-quality">Qualità controllata</option>
                        <option value="walk">Passeggiata</option>
                      </select>
                    </label>
                    <Field
                      label="Durata (min)"
                      type="number"
                      value={session.runConfig.durationMinutes}
                      onChange={(e) =>
                        updateRunConfig(session.templateId, { durationMinutes: Number(e.target.value) })
                      }
                    />
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        <Button onClick={savePlan}><Save /> Salva piano</Button>
      </Surface>

      <Surface>
        <div className="surface-heading">
          <div><p className="date-label">Assegnazione</p><h2>Invia piano al cliente</h2></div>
          <UserRoundCog />
        </div>
        <Field label="Email cliente" type="email" value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} />
        <Button onClick={assignPlan}><Send /> Assegna piano</Button>
      </Surface>

      {resolvedTemplates?.length ? (
        <Surface>
          <p className="date-label">Anteprima nomi applicati</p>
          {resolvedTemplates.filter((template) => template.kind !== "free").map((template) => (
            <p key={template.id}>{DAYS[template.dayOfWeek]} · <strong>{template.name}</strong></p>
          ))}
        </Surface>
      ) : null}

      {status ? <p className="success-message" role="status">{status}</p> : null}
    </div>
  );
}
