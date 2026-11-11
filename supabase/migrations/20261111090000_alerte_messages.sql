-- Alerte e-mail des messages des formulaires : chaque message est aussi envoyé à
-- taketontrail@gmail.com par la fonction supabase/functions/notify-message, une seule fois.
alter table public.messages add column if not exists notified_at timestamptz;
