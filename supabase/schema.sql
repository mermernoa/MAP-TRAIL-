-- Comptes Take Ton Trail : à exécuter une fois dans l'éditeur SQL du projet Supabase.
-- Chaque utilisateur ne peut lire et modifier que sa propre saison.

create table if not exists public.seasons (
  user_id uuid primary key references auth.users (id) on delete cascade,
  entries jsonb not null default '[]'::jsonb,
  custom_races jsonb not null default '[]'::jsonb,
  removed jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.seasons enable row level security;

-- Accès par l'API pour les utilisateurs connectés uniquement (aucun accès anonyme).
revoke all on table public.seasons from anon;
grant select, insert, update, delete on table public.seasons to authenticated;

drop policy if exists "Lire sa saison" on public.seasons;
create policy "Lire sa saison" on public.seasons
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Créer sa saison" on public.seasons;
create policy "Créer sa saison" on public.seasons
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Modifier sa saison" on public.seasons;
create policy "Modifier sa saison" on public.seasons
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Supprimer sa saison" on public.seasons;
create policy "Supprimer sa saison" on public.seasons
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Suppression du compte par son propriétaire (bouton « Supprimer mon compte »).
-- SECURITY DEFINER pour pouvoir effacer l'utilisateur ; la fonction ne touche qu'au compte
-- de l'appelant et n'est exécutable que par les utilisateurs connectés.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
