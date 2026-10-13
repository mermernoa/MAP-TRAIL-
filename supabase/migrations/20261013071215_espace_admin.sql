-- Espace admin (#/admin) : rôle admin, lecture des messages, réglages du site modifiables
-- sans toucher au code, compteur de pages anonyme et statistiques.
-- Ajouter un administrateur (éditeur SQL) :
--   insert into public.admins (user_id) select id from auth.users where email = '…';

-- Administrateurs : liste tenue à la main (éditeur SQL), invisible depuis l'API.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;

-- L'utilisateur connecté est-il administrateur ? (ne renseigne que sur soi-même)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Messages des formulaires : l'admin les lit, les marque traités, les supprime.
alter table public.messages add column if not exists handled boolean not null default false;
grant select, update, delete on table public.messages to authenticated;
create policy "Admin lit les messages" on public.messages
  for select to authenticated
  using ((select public.is_admin()));
create policy "Admin traite les messages" on public.messages
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Admin supprime les messages" on public.messages
  for delete to authenticated
  using ((select public.is_admin()));

-- Réglages du site (bandeau, coups de cœur, courses masquées, photos des massifs) :
-- lus par tous les visiteurs, modifiés par l'admin seulement.
create table if not exists public.site_settings (
  key text primary key check (key ~ '^[a-z_]{1,40}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
revoke all on table public.site_settings from anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
grant insert, update, delete on table public.site_settings to authenticated;
create policy "Lecture publique des réglages" on public.site_settings
  for select to anon, authenticated
  using (true);
create policy "Admin ajoute un réglage" on public.site_settings
  for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admin modifie un réglage" on public.site_settings
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Admin retire un réglage" on public.site_settings
  for delete to authenticated
  using ((select public.is_admin()));

-- Compteur de pages vues : un total par jour et par page, sans cookie, sans IP,
-- sans identifiant. Seule la fonction track_view peut l'incrémenter.
create table if not exists public.page_views (
  day date not null,
  path text not null check (char_length(path) <= 80),
  views integer not null default 0,
  primary key (day, path)
);
alter table public.page_views enable row level security;
revoke all on table public.page_views from anon, authenticated;

create or replace function public.track_view(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_path is null or p_path !~ '^/[a-z0-9/_-]{0,79}$' then
    return;
  end if;
  insert into public.page_views (day, path, views)
  values ((now() at time zone 'Europe/Paris')::date, p_path, 1)
  on conflict (day, path) do update set views = public.page_views.views + 1;
end;
$$;
revoke execute on function public.track_view(text) from public;
grant execute on function public.track_view(text) to anon, authenticated;

-- Tableau de bord de l'admin.
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Réservé à l''administration' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_confirmed', (select count(*) from auth.users where email_confirmed_at is not null),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'active_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'seasons', (select count(*) from public.seasons where jsonb_typeof(entries) = 'array' and jsonb_array_length(entries) > 0),
    'season_entries', (select coalesce(sum(jsonb_array_length(entries)), 0) from public.seasons where jsonb_typeof(entries) = 'array'),
    'messages_open', (select count(*) from public.messages where not handled),
    'messages_total', (select count(*) from public.messages),
    'views_today', (select coalesce(sum(views), 0) from public.page_views where day = today),
    'views_7d', (select coalesce(sum(views), 0) from public.page_views where day > today - 7),
    'views_30d', (select coalesce(sum(views), 0) from public.page_views where day > today - 30),
    'views_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb)
      from (select day as d, sum(views) as n from public.page_views where day > today - 30 group by day) v
    ),
    'signups_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb)
      from (
        select (created_at at time zone 'Europe/Paris')::date as d, count(*) as n
        from auth.users where created_at > now() - interval '30 days' group by 1
      ) s
    ),
    'top_pages', (
      select coalesce(jsonb_agg(jsonb_build_object('path', path, 'n', n) order by n desc), '[]'::jsonb)
      from (
        select path, sum(views) as n from public.page_views
        where day > today - 30 group by path order by n desc limit 15
      ) p
    ),
    'top_races', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'n', n) order by n desc), '[]'::jsonb)
      from (
        select e ->> 'eventId' as id, count(distinct s.user_id) as n
        from public.seasons s, jsonb_array_elements(case when jsonb_typeof(s.entries) = 'array' then s.entries else '[]'::jsonb end) e
        where e ->> 'eventId' is not null
        group by 1 order by n desc limit 15
      ) r
    )
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- Liste des comptes pour l'admin.
create or replace function public.admin_users()
returns table (
  id uuid,
  email text,
  name text,
  created_at timestamptz,
  confirmed boolean,
  last_sign_in_at timestamptz,
  races integer,
  admin boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé à l''administration' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, coalesce(u.raw_user_meta_data ->> 'name', ''), u.created_at,
      u.email_confirmed_at is not null, u.last_sign_in_at,
      case when jsonb_typeof(s.entries) = 'array' then jsonb_array_length(s.entries) else 0 end,
      exists (select 1 from public.admins a where a.user_id = u.id)
    from auth.users u
    left join public.seasons s on s.user_id = u.id
    order by u.created_at desc;
end;
$$;
revoke execute on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;
