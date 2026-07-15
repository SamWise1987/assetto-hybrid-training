-- Registra in modo auditabile il consenso espresso durante l'onboarding.
alter table public.athlete_profiles add column if not exists consent_accepted_at timestamptz;
alter table public.athlete_profiles add column if not exists consent_version text;
