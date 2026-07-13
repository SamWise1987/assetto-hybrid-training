-- Assetto hybrid training backend (Supabase)
-- Run in Supabase SQL Editor or via `supabase db push`

create extension if not exists "pgcrypto";

-- Device-scoped sync snapshots (opt-in, local-first)
create table if not exists public.sync_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text not null,
  schema_version integer not null default 2,
  payload jsonb not null,
  exported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create index if not exists sync_snapshots_user_id_idx on public.sync_snapshots (user_id);
create index if not exists sync_snapshots_updated_at_idx on public.sync_snapshots (updated_at desc);

-- Coach reviews (optional cloud backup)
create table if not exists public.coach_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week integer not null,
  summary text not null,
  strength_notes jsonb not null default '[]'::jsonb,
  run_notes jsonb not null default '[]'::jsonb,
  next_week_focus jsonb not null default '[]'::jsonb,
  source text not null check (source in ('openai', 'deterministic')),
  created_at timestamptz not null default now()
);

create index if not exists coach_reviews_user_week_idx on public.coach_reviews (user_id, week desc);

-- Sync consent audit
create table if not exists public.sync_consents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  consented_at timestamptz not null default now(),
  device_id text not null
);

alter table public.sync_snapshots enable row level security;
alter table public.coach_reviews enable row level security;
alter table public.sync_consents enable row level security;

create policy "Users manage own snapshots"
  on public.sync_snapshots
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own coach reviews"
  on public.coach_reviews
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own sync consent"
  on public.sync_consents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sync_snapshots_updated_at on public.sync_snapshots;
create trigger sync_snapshots_updated_at
  before update on public.sync_snapshots
  for each row execute function public.set_updated_at();
