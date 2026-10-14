-- Dépôt de traces GPX par les visiteurs (#/course/…, bloc « Trace GPX »), validées
-- dans l'espace admin. Un GPX validé s'affiche sur la fiche pour tout le monde.

-- Fichiers : espace privé « gpx », 10 Mo au plus par fichier, GPX seulement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gpx', 'gpx', false, 10485760, array['application/gpx+xml'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Propositions : une ligne par fichier déposé.
create table if not exists public.gpx_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id text not null check (event_id ~ '^[a-z0-9-]{1,120}$'),
  course_id text not null check (course_id ~ '^[a-z0-9]{1,20}$'),
  file_path text not null unique check (file_path ~ '^depots/[a-z0-9-]{1,120}/[a-z0-9]{1,20}/[0-9a-f-]{36}\.gpx$'),
  file_name text not null check (char_length(file_name) between 1 and 200),
  distance_km numeric check (distance_km between 0 and 2000),
  elevation_gain numeric check (elevation_gain between 0 and 100000),
  note text check (char_length(note) <= 500),
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'replaced')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists gpx_submissions_course on public.gpx_submissions (event_id, course_id, status);
alter table public.gpx_submissions enable row level security;
revoke all on table public.gpx_submissions from anon, authenticated;

-- Tout le monde peut proposer une trace (en attente, à son nom ou anonyme).
grant insert (event_id, course_id, file_path, file_name, distance_km, elevation_gain, note) on public.gpx_submissions to anon, authenticated;
create policy "Proposer une trace" on public.gpx_submissions
  for insert to anon, authenticated
  with check (status = 'pending' and reviewed_at is null and (user_id is null or user_id = (select auth.uid())));

-- Les traces validées sont publiques (sans la note ni l'auteur) ; l'admin voit tout.
grant select (id, event_id, course_id, file_path, file_name, status, reviewed_at) on public.gpx_submissions to anon, authenticated;
create policy "Lecture des traces validées" on public.gpx_submissions
  for select to anon, authenticated
  using (status = 'approved');
create policy "Admin lit les propositions" on public.gpx_submissions
  for select to authenticated
  using ((select public.is_admin()));

grant update (status, reviewed_at) on public.gpx_submissions to authenticated;
create policy "Admin valide les propositions" on public.gpx_submissions
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
grant delete on public.gpx_submissions to authenticated;
create policy "Admin supprime les propositions" on public.gpx_submissions
  for delete to authenticated
  using ((select public.is_admin()));

-- Liste complète pour l'admin (note et auteur compris), refusée à tout autre compte.
create or replace function public.admin_gpx_submissions()
returns table (
  id uuid,
  event_id text,
  course_id text,
  file_path text,
  file_name text,
  distance_km numeric,
  elevation_gain numeric,
  note text,
  author_email text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  return query
    select s.id, s.event_id, s.course_id, s.file_path, s.file_name, s.distance_km, s.elevation_gain, s.note,
           u.email::text, s.status, s.created_at, s.reviewed_at
    from public.gpx_submissions s
    left join auth.users u on u.id = s.user_id
    order by s.created_at desc
    limit 500;
end;
$$;
revoke execute on function public.admin_gpx_submissions() from public, anon;
grant execute on function public.admin_gpx_submissions() to authenticated;

-- Fichiers : dépôt dans « depots/… » pour tous ; lecture des fichiers validés pour tous,
-- de tous les fichiers pour l'admin ; suppression par l'admin.
create policy "Déposer un GPX" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'gpx' and (storage.foldername(name))[1] = 'depots');
create policy "Lire les GPX validés" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'gpx'
    and exists (select 1 from public.gpx_submissions s where s.file_path = name and s.status = 'approved')
  );
create policy "Admin lit tous les GPX" on storage.objects
  for select to authenticated
  using (bucket_id = 'gpx' and (select public.is_admin()));
create policy "Admin supprime les GPX" on storage.objects
  for delete to authenticated
  using (bucket_id = 'gpx' and (select public.is_admin()));
