-- Roles, training plans and assignments

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null default '',
  role text not null check (role in ('admin', 'coach', 'athlete')) default 'athlete',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sessions jsonb not null default '[]'::jsonb,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_plans_created_by_idx on public.training_plans (created_by);

create table if not exists public.plan_assignments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  athlete_email text not null,
  athlete_user_id uuid references auth.users (id) on delete set null,
  assigned_by uuid not null references auth.users (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  active boolean not null default true
);

create index if not exists plan_assignments_athlete_email_idx on public.plan_assignments (athlete_email);
create unique index if not exists plan_assignments_active_athlete_idx
  on public.plan_assignments (athlete_email)
  where active = true;

alter table public.user_roles enable row level security;
alter table public.training_plans enable row level security;
alter table public.plan_assignments enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.user_roles where user_id = auth.uid()), 'athlete');
$$;

create policy "Users read own role"
  on public.user_roles for select
  using (auth.uid() = user_id);

create policy "Staff read all roles"
  on public.user_roles for select
  using (public.current_user_role() in ('admin', 'coach'));

create policy "Admins manage roles"
  on public.user_roles for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "Staff manage training plans"
  on public.training_plans for all
  using (public.current_user_role() in ('admin', 'coach'))
  with check (public.current_user_role() in ('admin', 'coach'));

create policy "Athletes read assigned plans"
  on public.training_plans for select
  using (
    public.current_user_role() in ('admin', 'coach')
    or exists (
      select 1
      from public.plan_assignments pa
      join public.user_roles ur on ur.user_id = auth.uid()
      where pa.plan_id = training_plans.id
        and pa.active = true
        and lower(pa.athlete_email) = lower(ur.email)
    )
  );

create policy "Staff manage assignments"
  on public.plan_assignments for all
  using (public.current_user_role() in ('admin', 'coach'))
  with check (public.current_user_role() in ('admin', 'coach'));

create policy "Athletes read own assignments"
  on public.plan_assignments for select
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and lower(plan_assignments.athlete_email) = lower(ur.email)
    )
  );

drop trigger if exists user_roles_updated_at on public.user_roles;
create trigger user_roles_updated_at
  before update on public.user_roles
  for each row execute function public.set_updated_at();

drop trigger if exists training_plans_updated_at on public.training_plans;
create trigger training_plans_updated_at
  before update on public.training_plans
  for each row execute function public.set_updated_at();
