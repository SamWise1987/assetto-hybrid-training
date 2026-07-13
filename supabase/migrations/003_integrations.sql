-- External fitness service connections (Strava, future Garmin/Health)

create table if not exists public.service_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('strava', 'garmin', 'apple_health', 'health_connect')),
  external_athlete_id text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists service_connections_user_idx on public.service_connections (user_id);

alter table public.service_connections enable row level security;

create policy "Users manage own connections"
  on public.service_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists service_connections_updated_at on public.service_connections;
create trigger service_connections_updated_at
  before update on public.service_connections
  for each row execute function public.set_updated_at();

-- Extend training plans with optional run session overrides
comment on column public.training_plans.sessions is 'JSON array: may include prescriptions (strength) and runConfig (run days)';
