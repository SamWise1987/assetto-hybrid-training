-- Multipiattaforma foundation: trainer/client relationships, normalized activity,
-- Health sync, notifications, plan versions and actionable suggestions.

create table if not exists public.athlete_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  birth_year integer check (birth_year between 1900 and 2100),
  primary_goal text not null default 'hypertrophy',
  secondary_goals text[] not null default '{}',
  training_days smallint[] not null default '{}',
  equipment text[] not null default '{}',
  limitations text[] not null default '{}',
  onboarding_completed_at timestamptz,
  health_onboarding_skipped_at timestamptz,
  consent_accepted_at timestamptz,
  consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trainer_clients (
  id uuid primary key default gen_random_uuid(),
  trainer_user_id uuid not null references auth.users (id) on delete cascade,
  athlete_user_id uuid references auth.users (id) on delete set null,
  athlete_email text not null,
  status text not null default 'invited' check (status in ('invited', 'active', 'archived')),
  invited_by uuid not null references auth.users (id) on delete cascade,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (trainer_user_id, athlete_email)
);

create index if not exists trainer_clients_trainer_idx on public.trainer_clients (trainer_user_id, status);
create index if not exists trainer_clients_athlete_idx on public.trainer_clients (athlete_user_id) where athlete_user_id is not null;
create index if not exists trainer_clients_email_idx on public.trainer_clients (lower(athlete_email));

create table if not exists public.external_workouts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  external_id text not null,
  source text not null check (source in ('apple_health', 'health_connect', 'gpx', 'strava')),
  platform text not null check (platform in ('web', 'ios', 'android')),
  workout_type text not null,
  kind text not null check (kind in ('run', 'walk', 'strength', 'other')),
  start_date timestamptz not null,
  end_date timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  distance_km numeric(8,2),
  calories_kcal numeric(8,1),
  average_heart_rate integer,
  max_heart_rate integer,
  source_name text,
  matched_template_id text,
  matched_at timestamptz,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

create index if not exists external_workouts_user_start_idx on public.external_workouts (user_id, start_date desc);
create index if not exists external_workouts_unmatched_idx on public.external_workouts (user_id, kind, start_date desc) where matched_at is null;

create table if not exists public.training_session_logs (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id text not null,
  session_date date not null,
  status text not null,
  source text not null default 'app',
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists training_session_logs_user_date_idx on public.training_session_logs (user_id, session_date desc);

create table if not exists public.run_session_logs (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_date date not null,
  status text not null,
  source text not null default 'app',
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists run_session_logs_user_date_idx on public.run_session_logs (user_id, session_date desc);

create table if not exists public.readiness_logs (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists readiness_logs_user_date_idx on public.readiness_logs (user_id, log_date desc);

create table if not exists public.follow_up_logs (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  session_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists follow_up_logs_user_date_idx on public.follow_up_logs (user_id, log_date desc);

create table if not exists public.health_sync_states (
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  status text not null default 'never' check (status in ('never', 'syncing', 'success', 'denied', 'error')),
  last_attempt_at timestamptz,
  last_successful_sync_at timestamptz,
  last_imported_count integer not null default 0,
  last_skipped_count integer not null default 0,
  error_message text,
  updated_at timestamptz not null default now(),
  primary key (user_id, platform)
);

create table if not exists public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  reason text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (plan_id, version)
);

create table if not exists public.analysis_suggestions (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  rationale text not null,
  evidence jsonb not null default '[]'::jsonb,
  proposed_change jsonb not null default '{}'::jsonb,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'modified', 'applied', 'rejected', 'undone')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);

create index if not exists analysis_suggestions_athlete_idx on public.analysis_suggestions (athlete_user_id, created_at desc);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  href text,
  entity_type text,
  entity_id text,
  dedupe_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists app_notifications_recipient_idx on public.app_notifications (recipient_user_id, created_at desc);
create index if not exists app_notifications_unread_idx on public.app_notifications (recipient_user_id, created_at desc) where read_at is null;
create unique index if not exists app_notifications_dedupe_idx on public.app_notifications (dedupe_key) where dedupe_key is not null;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  target_user_id uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('web', 'ios', 'android')),
  endpoint text,
  native_token text,
  p256dh text,
  auth text,
  device_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, device_id)
);

create table if not exists public.app_error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  subsystem text not null check (subsystem in ('api', 'sync', 'health', 'notifications', 'ui', 'pwa')),
  severity text not null default 'error' check (severity in ('warning', 'error', 'fatal')),
  message text not null,
  context jsonb not null default '{}'::jsonb,
  platform text not null default 'web',
  app_version text,
  created_at timestamptz not null default now()
);
create index if not exists app_error_events_created_idx on public.app_error_events (created_at desc);
create index if not exists app_error_events_subsystem_idx on public.app_error_events (subsystem, created_at desc);

alter table public.athlete_profiles enable row level security;
alter table public.trainer_clients enable row level security;
alter table public.external_workouts enable row level security;
alter table public.training_session_logs enable row level security;
alter table public.run_session_logs enable row level security;
alter table public.readiness_logs enable row level security;
alter table public.follow_up_logs enable row level security;
alter table public.health_sync_states enable row level security;
alter table public.plan_versions enable row level security;
alter table public.analysis_suggestions enable row level security;
alter table public.app_notifications enable row level security;
alter table public.audit_log enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.app_error_events enable row level security;

create or replace function public.is_assigned_trainer(target_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trainer_clients tc
    where tc.trainer_user_id = auth.uid()
      and tc.athlete_user_id = target_user_id
      and tc.status = 'active'
  );
$$;

create policy "Athletes manage own profile" on public.athlete_profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Assigned staff read athlete profile" on public.athlete_profiles for select
  using (public.is_assigned_trainer(user_id));

create policy "Staff manage own client relationships" on public.trainer_clients for all
  using (public.current_user_role() = 'admin' or trainer_user_id = auth.uid())
  with check (public.current_user_role() = 'admin' or trainer_user_id = auth.uid());
create policy "Athletes read own trainer relationship" on public.trainer_clients for select
  using (athlete_user_id = auth.uid() or lower(athlete_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "Athletes manage own external workouts" on public.external_workouts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Assigned staff read external workouts" on public.external_workouts for select
  using (public.is_assigned_trainer(user_id));

create policy "Athletes manage own training logs" on public.training_session_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Assigned staff read training logs" on public.training_session_logs for select
  using (public.is_assigned_trainer(user_id));
create policy "Athletes manage own run logs" on public.run_session_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Assigned staff read run logs" on public.run_session_logs for select
  using (public.is_assigned_trainer(user_id));
create policy "Athletes manage own readiness logs" on public.readiness_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Assigned staff read readiness logs" on public.readiness_logs for select
  using (public.is_assigned_trainer(user_id));
create policy "Athletes manage own follow-up logs" on public.follow_up_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Assigned staff read follow-up logs" on public.follow_up_logs for select
  using (public.is_assigned_trainer(user_id));

create policy "Athletes manage own health state" on public.health_sync_states for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Assigned staff read health state" on public.health_sync_states for select
  using (public.is_assigned_trainer(user_id));

create policy "Staff manage plan versions" on public.plan_versions for all
  using (public.current_user_role() = 'admin' or exists (select 1 from public.training_plans tp where tp.id = plan_versions.plan_id and tp.created_by = auth.uid()))
  with check (public.current_user_role() = 'admin' or exists (select 1 from public.training_plans tp where tp.id = plan_versions.plan_id and tp.created_by = auth.uid()));
create policy "Athletes read assigned plan versions" on public.plan_versions for select
  using (exists (select 1 from public.plan_assignments pa where pa.plan_id = plan_versions.plan_id and pa.athlete_user_id = auth.uid() and pa.active));

create policy "Relevant users read suggestions" on public.analysis_suggestions for select
  using (auth.uid() = athlete_user_id or public.is_assigned_trainer(athlete_user_id));
create policy "Assigned staff manage suggestions" on public.analysis_suggestions for all
  using (public.is_assigned_trainer(athlete_user_id))
  with check (public.is_assigned_trainer(athlete_user_id));

create policy "Users read own notifications" on public.app_notifications for select using (auth.uid() = recipient_user_id);
create policy "Users update own notifications" on public.app_notifications for update using (auth.uid() = recipient_user_id) with check (auth.uid() = recipient_user_id);
create policy "Staff create notifications" on public.app_notifications for insert
  with check (public.current_user_role() in ('admin', 'coach') and (public.current_user_role() = 'admin' or public.is_assigned_trainer(recipient_user_id)));
create policy "Admins read audit log" on public.audit_log for select
  using (public.current_user_role() = 'admin');
create policy "Staff append audit log" on public.audit_log for insert
  with check (public.current_user_role() in ('admin', 'coach') and actor_user_id = auth.uid());
create policy "Users manage own push subscriptions" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users append own error events" on public.app_error_events for insert
  with check (auth.uid() = user_id);
create policy "Admins read error events" on public.app_error_events for select
  using (public.current_user_role() = 'admin');

-- Replace the broad v2 staff policies with ownership-aware policies.
drop policy if exists "Staff manage training plans" on public.training_plans;
create policy "Admins manage all training plans" on public.training_plans for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy "Coaches manage own training plans" on public.training_plans for all
  using (public.current_user_role() = 'coach' and created_by = auth.uid())
  with check (public.current_user_role() = 'coach' and created_by = auth.uid());

drop policy if exists "Staff manage assignments" on public.plan_assignments;
create policy "Admins manage all assignments" on public.plan_assignments for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy "Coaches manage own client assignments" on public.plan_assignments for all
  using (
    public.current_user_role() = 'coach'
    and assigned_by = auth.uid()
    and exists (select 1 from public.training_plans tp where tp.id = plan_assignments.plan_id and tp.created_by = auth.uid())
  )
  with check (
    public.current_user_role() = 'coach'
    and assigned_by = auth.uid()
    and exists (select 1 from public.trainer_clients tc where tc.trainer_user_id = auth.uid() and lower(tc.athlete_email) = lower(plan_assignments.athlete_email) and tc.status in ('invited', 'active'))
    and exists (select 1 from public.training_plans tp where tp.id = plan_assignments.plan_id and tp.created_by = auth.uid())
  );

drop trigger if exists athlete_profiles_updated_at on public.athlete_profiles;
create trigger athlete_profiles_updated_at before update on public.athlete_profiles for each row execute function public.set_updated_at();
drop trigger if exists external_workouts_updated_at on public.external_workouts;
create trigger external_workouts_updated_at before update on public.external_workouts for each row execute function public.set_updated_at();
drop trigger if exists health_sync_states_updated_at on public.health_sync_states;
create trigger health_sync_states_updated_at before update on public.health_sync_states for each row execute function public.set_updated_at();
drop trigger if exists training_session_logs_updated_at on public.training_session_logs;
create trigger training_session_logs_updated_at before update on public.training_session_logs for each row execute function public.set_updated_at();
drop trigger if exists run_session_logs_updated_at on public.run_session_logs;
create trigger run_session_logs_updated_at before update on public.run_session_logs for each row execute function public.set_updated_at();
drop trigger if exists readiness_logs_updated_at on public.readiness_logs;
create trigger readiness_logs_updated_at before update on public.readiness_logs for each row execute function public.set_updated_at();
drop trigger if exists follow_up_logs_updated_at on public.follow_up_logs;
create trigger follow_up_logs_updated_at before update on public.follow_up_logs for each row execute function public.set_updated_at();
drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at before update on public.push_subscriptions for each row execute function public.set_updated_at();

-- Link pending invitations on first profile creation/login.
create or replace function public.link_pending_trainer_clients()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.trainer_clients
  set athlete_user_id = new.user_id, status = 'active', accepted_at = coalesce(accepted_at, now())
  where lower(athlete_email) = lower(new.email) and athlete_user_id is null;

  update public.plan_assignments
  set athlete_user_id = new.user_id
  where lower(athlete_email) = lower(new.email) and athlete_user_id is null;
  return new;
end;
$$;

drop trigger if exists link_pending_trainer_clients_trigger on public.user_roles;
create trigger link_pending_trainer_clients_trigger after insert or update of email on public.user_roles
for each row execute function public.link_pending_trainer_clients();

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_notifications'
  ) then
    alter publication supabase_realtime add table public.app_notifications;
  end if;
end $$;
