-- When a client activates an invited account, link pending relationships and
-- assignments atomically and create the inbox event that could not be emitted
-- before the auth user existed.
create or replace function public.link_pending_trainer_clients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trainer_clients
  set athlete_user_id = new.user_id,
      status = 'active',
      accepted_at = coalesce(accepted_at, now())
  where lower(athlete_email) = lower(new.email)
    and athlete_user_id is null;

  with linked_assignments as (
    update public.plan_assignments
    set athlete_user_id = new.user_id
    where lower(athlete_email) = lower(new.email)
      and athlete_user_id is null
    returning id, plan_id, assigned_by, active
  )
  insert into public.app_notifications (
    recipient_user_id,
    actor_user_id,
    type,
    title,
    body,
    href,
    entity_type,
    entity_id,
    dedupe_key
  )
  select
    new.user_id,
    linked.assigned_by,
    'plan_assigned',
    'Nuovo piano disponibile',
    format('Il trainer ti ha assegnato “%s”.', plan.name),
    '/?tab=today',
    'training_plan',
    linked.plan_id::text,
    concat(new.user_id, ':plan_assigned:', linked.plan_id, ':', linked.id)
  from linked_assignments linked
  join public.training_plans plan on plan.id = linked.plan_id
  where linked.active
  on conflict do nothing;

  return new;
end;
$$;
