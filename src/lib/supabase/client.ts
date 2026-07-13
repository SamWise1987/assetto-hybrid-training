import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TrainingPlanSession } from "@/lib/types";

type UserRole = "admin" | "coach" | "athlete";
type CoachReviewSource = "openai" | "deterministic";
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type RemoteTrainingPlanRow = {
  id: string;
  name: string;
  description: string | null;
  sessions: TrainingPlanSession[];
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      sync_snapshots: {
        Row: {
          id: string;
          user_id: string;
          device_id: string;
          schema_version: number;
          payload: Json;
          exported_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          device_id: string;
          schema_version?: number;
          payload: Json;
          exported_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sync_snapshots"]["Insert"]>;
        Relationships: [];
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
          source: CoachReviewSource;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week: number;
          summary: string;
          strength_notes?: string[];
          run_notes?: string[];
          next_week_focus?: string[];
          source: CoachReviewSource;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["coach_reviews"]["Insert"]>;
        Relationships: [];
      };
      sync_consents: {
        Row: {
          user_id: string;
          consented_at: string;
          device_id: string;
        };
        Insert: {
          user_id: string;
          consented_at?: string;
          device_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["sync_consents"]["Insert"]>;
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          email: string;
          display_name: string;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email: string;
          display_name?: string;
          role?: UserRole;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
        Relationships: [];
      };
      training_plans: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          sessions: Json;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          sessions: Json;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["training_plans"]["Insert"]>;
        Relationships: [];
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
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
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
