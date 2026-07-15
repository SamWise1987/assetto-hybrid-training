-- I retry offline non devono creare più notifiche/push per lo stesso evento.
alter table public.app_notifications add column if not exists dedupe_key text;
create unique index if not exists app_notifications_dedupe_idx
on public.app_notifications (dedupe_key)
where dedupe_key is not null;
