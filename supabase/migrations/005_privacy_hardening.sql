-- Privacy per ruolo e isolamento dei dettagli sanitari.
-- L'admin gestisce struttura e stato operativo tramite endpoint server con
-- proiezioni limitate; soltanto il trainer assegnato legge i dettagli atleta.

drop policy if exists "Assigned staff read athlete profile" on public.athlete_profiles;
create policy "Assigned staff read athlete profile"
on public.athlete_profiles for select
using (public.is_assigned_trainer(user_id));

drop policy if exists "Assigned staff read health state" on public.health_sync_states;
create policy "Assigned staff read health state"
on public.health_sync_states for select
using (public.is_assigned_trainer(user_id));

drop policy if exists "Relevant users read suggestions" on public.analysis_suggestions;
create policy "Relevant users read suggestions"
on public.analysis_suggestions for select
using (auth.uid() = athlete_user_id or public.is_assigned_trainer(athlete_user_id));

drop policy if exists "Assigned staff manage suggestions" on public.analysis_suggestions;
create policy "Assigned staff manage suggestions"
on public.analysis_suggestions for all
using (public.is_assigned_trainer(athlete_user_id))
with check (public.is_assigned_trainer(athlete_user_id));
