-- Supabase donne par défaut tous les droits sur les nouvelles tables aux rôles de l'API.
-- La RLS filtre déjà les lignes, mais pas TRUNCATE : on ne garde que les droits utiles,
-- la saison pour les connectés, l'envoi de message pour tous.
revoke all on table public.seasons from anon;
revoke truncate, references, trigger on table public.seasons from authenticated;
revoke all on table public.messages from anon, authenticated;
grant insert on table public.messages to anon, authenticated;
revoke execute on function public.delete_my_account() from public, anon;
