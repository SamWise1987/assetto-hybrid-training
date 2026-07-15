import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TrainingPlanSession } from "@/lib/types";

type UserRole = "admin" | "coach" | "athlete";
type CoachReviewSource = "openai" | "deterministic";
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type LooseUpdate = { [key: string]: Json | undefined };

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
        Update: LooseUpdate;
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
        Update: LooseUpdate;
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
        Update: LooseUpdate;
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
        Update: LooseUpdate;
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
        Update: LooseUpdate;
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
        Update: LooseUpdate;
        Relationships: [];
      };
      service_connections: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          external_athlete_id: string | null;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          scopes: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          external_athlete_id?: string | null;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          scopes?: string[];
        };
        Update: LooseUpdate;
        Relationships: [];
      };
      athlete_profiles: {
        Row: {
          user_id: string; display_name: string; birth_year: number | null; primary_goal: string;
          secondary_goals: string[]; training_days: number[]; equipment: string[]; limitations: string[];
          onboarding_completed_at: string | null; health_onboarding_skipped_at: string | null; consent_accepted_at: string | null; consent_version: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          user_id: string; display_name?: string; birth_year?: number | null; primary_goal?: string;
          secondary_goals?: string[]; training_days?: number[]; equipment?: string[]; limitations?: string[];
          onboarding_completed_at?: string | null; health_onboarding_skipped_at?: string | null; consent_accepted_at?: string | null; consent_version?: string | null;
        };
        Update: LooseUpdate;
        Relationships: [];
      };
      trainer_clients: {
        Row: {
          id: string; trainer_user_id: string; athlete_user_id: string | null; athlete_email: string;
          status: "invited" | "active" | "archived"; invited_by: string; invited_at: string; accepted_at: string | null;
        };
        Insert: {
          id?: string; trainer_user_id: string; athlete_user_id?: string | null; athlete_email: string;
          status?: "invited" | "active" | "archived"; invited_by: string; accepted_at?: string | null;
        };
        Update: LooseUpdate;
        Relationships: [];
      };
      external_workouts: {
        Row: {
          id: string; user_id: string; external_id: string; source: string; platform: string; workout_type: string;
          kind: string; start_date: string; end_date: string; duration_minutes: number; distance_km: number | null;
          calories_kcal: number | null; average_heart_rate: number | null; max_heart_rate: number | null;
          source_name: string | null; matched_template_id: string | null; matched_at: string | null;
          imported_at: string; updated_at: string;
        };
        Insert: {
          id: string; user_id: string; external_id: string; source: string; platform: string; workout_type: string;
          kind: string; start_date: string; end_date: string; duration_minutes: number; distance_km?: number | null;
          calories_kcal?: number | null; average_heart_rate?: number | null; max_heart_rate?: number | null;
          source_name?: string | null; matched_template_id?: string | null; matched_at?: string | null; imported_at?: string;
        };
        Update: LooseUpdate;
        Relationships: [];
      };
      training_session_logs: {
        Row: { id: string; user_id: string; template_id: string; session_date: string; status: string; source: string; payload: Json; updated_at: string };
        Insert: { id: string; user_id: string; template_id: string; session_date: string; status: string; source?: string; payload: Json };
        Update: LooseUpdate;
        Relationships: [];
      };
      run_session_logs: {
        Row: { id: string; user_id: string; session_date: string; status: string; source: string; payload: Json; updated_at: string };
        Insert: { id: string; user_id: string; session_date: string; status: string; source?: string; payload: Json };
        Update: LooseUpdate;
        Relationships: [];
      };
      readiness_logs: {
        Row: { id: string; user_id: string; log_date: string; payload: Json; updated_at: string };
        Insert: { id: string; user_id: string; log_date: string; payload: Json };
        Update: LooseUpdate;
        Relationships: [];
      };
      follow_up_logs: {
        Row: { id: string; user_id: string; log_date: string; session_id: string; payload: Json; updated_at: string };
        Insert: { id: string; user_id: string; log_date: string; session_id: string; payload: Json };
        Update: LooseUpdate;
        Relationships: [];
      };
      health_sync_states: {
        Row: {
          user_id: string; platform: string; status: string; last_attempt_at: string | null;
          last_successful_sync_at: string | null; last_imported_count: number; last_skipped_count: number;
          error_message: string | null; updated_at: string;
        };
        Insert: {
          user_id: string; platform: string; status?: string; last_attempt_at?: string | null;
          last_successful_sync_at?: string | null; last_imported_count?: number; last_skipped_count?: number;
          error_message?: string | null;
        };
        Update: LooseUpdate;
        Relationships: [];
      };
      plan_versions: {
        Row: { id: string; plan_id: string; version: number; snapshot: Json; reason: string; created_by: string; created_at: string };
        Insert: { id?: string; plan_id: string; version: number; snapshot: Json; reason: string; created_by: string };
        Update: LooseUpdate;
        Relationships: [];
      };
      analysis_suggestions: {
        Row: {
          id: string; athlete_user_id: string; title: string; rationale: string; evidence: Json;
          proposed_change: Json; status: string; created_at: string; reviewed_at: string | null; reviewed_by: string | null;
        };
        Insert: {
          id?: string; athlete_user_id: string; title: string; rationale: string; evidence?: Json;
          proposed_change?: Json; status?: string; reviewed_at?: string | null; reviewed_by?: string | null;
        };
        Update: LooseUpdate;
        Relationships: [];
      };
      app_notifications: {
        Row: {
          id: string; recipient_user_id: string; actor_user_id: string | null; type: string; title: string;
          body: string; href: string | null; entity_type: string | null; entity_id: string | null;
          dedupe_key: string | null; created_at: string; read_at: string | null;
        };
        Insert: {
          id?: string; recipient_user_id: string; actor_user_id?: string | null; type: string; title: string;
          body: string; href?: string | null; entity_type?: string | null; entity_id?: string | null; dedupe_key?: string | null; read_at?: string | null;
        };
        Update: LooseUpdate;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string; actor_user_id: string | null; action: string; entity_type: string;
          entity_id: string | null; target_user_id: string | null; metadata: Json; created_at: string;
        };
        Insert: {
          id?: string; actor_user_id?: string | null; action: string; entity_type: string;
          entity_id?: string | null; target_user_id?: string | null; metadata?: Json; created_at?: string;
        };
        Update: LooseUpdate;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string; user_id: string; platform: "web" | "ios" | "android"; endpoint: string | null;
          native_token: string | null; p256dh: string | null; auth: string | null; device_id: string;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; user_id: string; platform: "web" | "ios" | "android"; endpoint?: string | null;
          native_token?: string | null; p256dh?: string | null; auth?: string | null; device_id: string;
        };
        Update: LooseUpdate;
        Relationships: [];
      };
      app_error_events: {
        Row: { id: string; user_id: string | null; subsystem: string; severity: string; message: string; context: Json; platform: string; app_version: string | null; created_at: string };
        Insert: { id?: string; user_id?: string | null; subsystem: string; severity?: string; message: string; context?: Json; platform?: string; app_version?: string | null };
        Update: LooseUpdate;
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
