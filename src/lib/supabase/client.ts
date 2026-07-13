import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Database = {
  public: {
    Tables: {
      sync_snapshots: {
        Row: {
          id: string;
          user_id: string;
          device_id: string;
          schema_version: number;
          payload: Record<string, unknown>;
          exported_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          device_id: string;
          schema_version?: number;
          payload: Record<string, unknown>;
          exported_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sync_snapshots"]["Insert"]>;
      };
      coach_reviews: {
        Row: {
          id: string;
          user_id: string;
          week: number;
          summary: string;
          strength_notes: string[];
          run_notes: string[];
          next_week_focus: string[];
          source: "openai" | "deterministic";
          created_at: string;
        };
      };
      sync_consents: {
        Row: {
          user_id: string;
          consented_at: string;
          device_id: string;
        };
      };
      user_roles: {
        Row: {
          user_id: string;
          email: string;
          display_name: string;
          role: "admin" | "coach" | "athlete";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email: string;
          display_name?: string;
          role?: "admin" | "coach" | "athlete";
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
      };
      training_plans: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          sessions: import("@/lib/types").TrainingPlanSession[];
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          sessions: import("@/lib/types").TrainingPlanSession[];
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["training_plans"]["Insert"]>;
      };
      plan_assignments: {
        Row: {
          id: string;
          plan_id: string;
          athlete_email: string;
          athlete_user_id: string | null;
          assigned_by: string;
          assigned_at: string;
          active: boolean;
        };
        Insert: {
          id?: string;
          plan_id: string;
          athlete_email: string;
          athlete_user_id?: string | null;
          assigned_by: string;
          active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["plan_assignments"]["Insert"]>;
      };
    };
  };
};

let browserClient: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function createBrowserSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (browserClient) return browserClient;

  browserClient = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );

  return browserClient;
}

export const DEVICE_ID_KEY = "assetto-device-id";

export function getOrCreateDeviceId() {
  if (typeof window === "undefined") return "server";
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}
