-- Durées de conservation annoncées sur la page Confidentialité :
-- messages des formulaires effacés un an après leur envoi, compteur de pages vues après deux ans.
-- À exécuter une fois dans l'éditeur SQL de Supabase (SQL Editor > New query > Run).
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.purge_old_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.messages where created_at < now() - interval '1 year';
  delete from public.page_views where day < current_date - interval '2 years';
$$;
revoke execute on function public.purge_old_data() from public, anon, authenticated;

-- Tous les jours à 3 h 17 (UTC).
select cron.schedule('purge-old-data', '17 3 * * *', 'select public.purge_old_data()');
