-- Anti-spam des messages des formulaires, appliqué par la base (impossible à contourner
-- en écrivant directement à l'API) :
-- - 3 messages par heure au plus pour une même adresse e-mail ;
-- - 20 messages en 10 minutes au plus pour tout le site (vague de robots) ;
-- - 4 liens au plus dans un message ;
-- - adresses de domaines gratuits jetables utilisés par les robots refusées.
create or replace function public.messages_anti_spam()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  links int;
begin
  if (select count(*) from public.messages where created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'Trop de messages en ce moment, réessaie plus tard.' using errcode = 'P0001';
  end if;
  if new.email is not null then
    if lower(new.email) ~ '\.(my\.id|biz\.id|web\.id|tk|ml|ga|cf|gq)$' then
      raise exception 'Adresse e-mail refusée.' using errcode = 'P0001';
    end if;
    if (select count(*) from public.messages
        where lower(email) = lower(new.email) and created_at > now() - interval '1 hour') >= 3 then
      raise exception 'Trop de messages depuis cette adresse, réessaie plus tard.' using errcode = 'P0001';
    end if;
  end if;
  links := (select count(*) from regexp_matches(new.body, 'https?://', 'g'));
  if links > 4 then
    raise exception 'Trop de liens dans le message.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.messages_anti_spam() from public, anon, authenticated;

drop trigger if exists messages_anti_spam on public.messages;
create trigger messages_anti_spam
  before insert on public.messages
  for each row execute function public.messages_anti_spam();
