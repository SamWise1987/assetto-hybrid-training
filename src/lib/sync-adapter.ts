export interface SyncAdapter {
  push(snapshot: unknown): Promise<void>;
  pull(): Promise<unknown>;
}

export interface CoachAdapter {
  review(snapshot: unknown, apiKey?: string): Promise<unknown>;
}

/**
 * Deliberately disabled in v1. A future Supabase implementation must be opt-in,
 * encrypted in transit, and must never run before explicit user consent.
 */
export class DisabledSyncAdapter implements SyncAdapter {
  async push(): Promise<void> {
    throw new Error("Sincronizzazione remota non configurata: i dati restano sul dispositivo.");
  }

  async pull(): Promise<unknown> {
    throw new Error("Sincronizzazione remota non configurata: i dati restano sul dispositivo.");
  }
}

export class DisabledCoachAdapter implements CoachAdapter {
  async review(): Promise<unknown> {
    throw new Error("Coach AI non configurato: imposta OPENAI_API_KEY o la chiave nelle impostazioni.");
  }
}

export class OpenAICoachAdapter implements CoachAdapter {
  constructor(private readonly endpoint = "/api/coach") {}

  async review(snapshot: unknown, apiKey?: string): Promise<unknown> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "x-assetto-openai-key": apiKey } : {}),
      },
      body: JSON.stringify({ snapshot }),
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({ error: "Errore coach AI" }))) as {
        error?: string;
      };
      throw new Error(error.error ?? "Coach AI non disponibile.");
    }

    return response.json();
  }
}

export function createCoachAdapter(enabled: boolean, hasKey: boolean): CoachAdapter {
  if (!enabled || !hasKey) return new DisabledCoachAdapter();
  return new OpenAICoachAdapter();
}

export class SupabaseSyncAdapter implements SyncAdapter {
  constructor(
    private readonly pushFn: (payload: unknown) => Promise<void>,
    private readonly pullFn: () => Promise<unknown>,
  ) {}

  async push(snapshot: unknown): Promise<void> {
    await this.pushFn(snapshot);
  }

  async pull(): Promise<unknown> {
    return this.pullFn();
  }
}

export function createSupabaseSyncAdapter(
  pushFn: (payload: unknown) => Promise<void>,
  pullFn: () => Promise<unknown>,
): SyncAdapter {
  return new SupabaseSyncAdapter(pushFn, pullFn);
}

export const disabledSyncAdapter = new DisabledSyncAdapter();
