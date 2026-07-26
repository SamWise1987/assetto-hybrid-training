-- Metriche vitali da Apple Health / Health Connect (FC a riposo, HRV, respiro, SpO2, passi, sonno).
-- L'iPhone importa da HealthKit; il cloud permette alla webapp di leggere gli stessi segnali.

create table if not exists public.health_metric_samples (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  metric_type text not null check (metric_type in (
    'restingHeartRate',
    'heartRateVariability',
    'respiratoryRate',
    'oxygenSaturation',
    'steps',
    'sleepMinutes'
  )),
  value numeric not null check (value > 0),
  unit text not null,
  recorded_at timestamptz not null,
  end_at timestamptz,
  source text not null check (source in ('apple_health', 'health_connect')),
  platform text not null check (platform in ('web', 'ios', 'android')),
  external_id text not null,
  platform_id text,
  source_name text,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

create index if not exists health_metric_samples_user_recorded_idx
  on public.health_metric_samples (user_id, recorded_at desc);
create index if not exists health_metric_samples_user_type_idx
  on public.health_metric_samples (user_id, metric_type, recorded_at desc);

alter table public.health_metric_samples enable row level security;

drop policy if exists "Athletes manage own health metrics" on public.health_metric_samples;
create policy "Athletes manage own health metrics" on public.health_metric_samples for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Assigned staff read health metrics" on public.health_metric_samples;
create policy "Assigned staff read health metrics" on public.health_metric_samples for select
  using (
    exists (
      select 1 from public.trainer_clients
      where trainer_clients.trainer_user_id = auth.uid()
        and trainer_clients.athlete_user_id = health_metric_samples.user_id
        and trainer_clients.status = 'active'
    )
  );

drop trigger if exists health_metric_samples_updated_at on public.health_metric_samples;
create trigger health_metric_samples_updated_at
  before update on public.health_metric_samples
  for each row execute function public.set_updated_at();
