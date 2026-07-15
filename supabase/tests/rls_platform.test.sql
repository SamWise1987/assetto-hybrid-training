begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('10000000-0000-4000-8000-000000000001', 'admin@test.local', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('20000000-0000-4000-8000-000000000001', 'coach1@test.local', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('20000000-0000-4000-8000-000000000002', 'coach2@test.local', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('30000000-0000-4000-8000-000000000001', 'athlete1@test.local', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('30000000-0000-4000-8000-000000000002', 'athlete2@test.local', '', now(), '{}', '{}', 'authenticated', 'authenticated');

insert into public.user_roles (user_id, email, display_name, role) values
  ('10000000-0000-4000-8000-000000000001', 'admin@test.local', 'Admin', 'admin'),
  ('20000000-0000-4000-8000-000000000001', 'coach1@test.local', 'Coach 1', 'coach'),
  ('20000000-0000-4000-8000-000000000002', 'coach2@test.local', 'Coach 2', 'coach'),
  ('30000000-0000-4000-8000-000000000001', 'athlete1@test.local', 'Athlete 1', 'athlete'),
  ('30000000-0000-4000-8000-000000000002', 'athlete2@test.local', 'Athlete 2', 'athlete')
on conflict (user_id) do update set role = excluded.role;

insert into public.trainer_clients (trainer_user_id, athlete_user_id, athlete_email, status, invited_by) values
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'athlete1@test.local', 'active', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'athlete2@test.local', 'active', '10000000-0000-4000-8000-000000000001');

insert into public.training_session_logs (id, user_id, template_id, session_date, status, payload) values
  ('same-local-id', '30000000-0000-4000-8000-000000000001', 'strength-a', current_date, 'complete', '{}'),
  ('same-local-id', '30000000-0000-4000-8000-000000000002', 'strength-a', current_date, 'complete', '{}');
insert into public.app_notifications (recipient_user_id, type, title, body, dedupe_key) values
  ('30000000-0000-4000-8000-000000000001', 'plan_updated', 'Plan 1', 'Updated', 'event-1'),
  ('30000000-0000-4000-8000-000000000002', 'plan_updated', 'Plan 2', 'Updated', 'event-2');
select throws_ok($$insert into public.app_notifications (recipient_user_id,type,title,body,dedupe_key) values ('30000000-0000-4000-8000-000000000001','plan_updated','Duplicate','Duplicate','event-1')$$, '23505', null, 'notification event keys are idempotent');
insert into public.athlete_profiles (user_id, display_name, primary_goal, limitations) values
  ('30000000-0000-4000-8000-000000000001', 'Athlete 1', 'hybrid', array['private limitation']),
  ('30000000-0000-4000-8000-000000000002', 'Athlete 2', 'running', array['private limitation']);
insert into public.health_sync_states (user_id, platform, status, error_message) values
  ('30000000-0000-4000-8000-000000000001', 'ios', 'success', null),
  ('30000000-0000-4000-8000-000000000002', 'android', 'error', 'private provider detail');
insert into public.analysis_suggestions (athlete_user_id, title, rationale, evidence) values
  ('30000000-0000-4000-8000-000000000001', 'Suggestion 1', 'Private rationale', '["private evidence"]'),
  ('30000000-0000-4000-8000-000000000002', 'Suggestion 2', 'Private rationale', '["private evidence"]');

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001","email":"athlete1@test.local","role":"authenticated"}', true);
select is((select count(*)::int from public.training_session_logs), 1, 'athlete reads only own training log');
select is((select count(*)::int from public.app_notifications), 1, 'athlete reads only own notification');
select throws_ok($$insert into public.training_session_logs (id,user_id,template_id,session_date,status,payload) values ('foreign','30000000-0000-4000-8000-000000000002','x',current_date,'complete','{}')$$, '42501', null, 'athlete cannot write another athlete log');

select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000001","email":"coach1@test.local","role":"authenticated"}', true);
select is((select count(*)::int from public.training_session_logs), 1, 'coach reads only assigned client log');
select is((select user_id::text from public.training_session_logs limit 1), '30000000-0000-4000-8000-000000000001', 'coach cannot read another trainer client');
select throws_ok($$insert into public.training_session_logs (id,user_id,template_id,session_date,status,payload) values ('coach-write','30000000-0000-4000-8000-000000000001','x',current_date,'complete','{}')$$, '42501', null, 'coach cannot fabricate athlete logs');
select is((select count(*)::int from public.athlete_profiles), 1, 'coach reads only assigned athlete profile');
select is((select count(*)::int from public.health_sync_states), 1, 'coach reads only assigned Health state');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@test.local","role":"authenticated"}', true);
select is((select count(*)::int from public.trainer_clients), 2, 'admin sees structure relationships');
select is((select count(*)::int from public.training_session_logs), 0, 'admin does not see detailed athlete logs');
select is((select count(*)::int from public.athlete_profiles), 0, 'admin cannot query detailed athlete profiles directly');
select is((select count(*)::int from public.health_sync_states), 0, 'admin cannot query raw Health state directly');
select is((select count(*)::int from public.analysis_suggestions), 0, 'admin cannot query athlete suggestions');

select * from finish();
rollback;
