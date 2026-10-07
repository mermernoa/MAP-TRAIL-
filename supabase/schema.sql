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

-- Messages des formulaires : contact, signalement d'erreur, proposition de course.
-- Tout visiteur peut en envoyer ; personne ne peut les relire par l'API.
-- On les consulte dans le tableau de bord Supabase (Table Editor > messages).
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contact', 'erreur', 'course')),
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null check (char_length(body) between 1 and 5000),
  email text check (email is null or char_length(email) <= 200),
  course_id text check (course_id is null or char_length(course_id) <= 120),
  page text check (page is null or char_length(page) <= 500),
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

revoke all on table public.messages from anon, authenticated;
grant insert on table public.messages to anon, authenticated;

drop policy if exists "Envoyer un message" on public.messages;
create policy "Envoyer un message" on public.messages
  for insert to anon, authenticated
  with check (true);
