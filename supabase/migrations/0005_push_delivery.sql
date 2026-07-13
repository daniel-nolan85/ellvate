-- Deliver a push via the Expo Push API whenever an in-app notification is
-- created, to every device the recipient has registered, respecting their
-- per-kind notification preference. Uses pg_net (async, fire-and-forget) so
-- delivery never blocks the writing transaction. No app-side service role.

create extension if not exists pg_net;

create or replace function public.deliver_push() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  tokens text[];
  wants boolean;
begin
  select case new.kind
           when 'comment' then u.notif_replies
           when 'event' then u.notif_events
           when 'mission' then u.notif_missions
           else true
         end
    into wants
    from public.app_users u
    where u.id = new.user_id;

  if wants is distinct from true then
    return new;
  end if;

  select array_agg(t.token) into tokens
    from public.push_tokens t
    where t.user_id = new.user_id;

  if tokens is null or array_length(tokens, 1) = 0 then
    return new;
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'to', to_jsonb(tokens),
      'title', new.title,
      'body', new.body,
      'data', new.data,
      'sound', 'default'
    )
  );

  return new;
end;
$$;

create trigger notifications_deliver_push
after insert on notifications
for each row execute function public.deliver_push();
