-- Notify a post's author when someone likes it, mirroring
-- `notify_post_author` (0003) for comments. There's no dedicated "likes"
-- notification preference column, so push delivery reuses `notif_replies`
-- (the existing "engagement on your post" bucket) rather than adding new
-- schema/UI just for this.

create or replace function public.notify_post_liker() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  author text;
  post_title text;
  liker_name text;
begin
  select p.author_id, p.title into author, post_title
    from public.posts p where p.id = new.post_id;
  if author is null or author = new.user_id then
    return new;
  end if;
  select u.name into liker_name from public.app_users u where u.id = new.user_id;
  insert into public.notifications (user_id, kind, title, body, data)
  values (
    author,
    'like',
    'New like on your post',
    coalesce(liker_name, 'Someone') || ' liked "' || post_title || '"',
    jsonb_build_object('postId', new.post_id)
  );
  return new;
end;
$$;

create trigger post_likes_notify_author
after insert on post_likes
for each row execute function public.notify_post_liker();

create or replace function public.deliver_push() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  tokens text[];
  wants boolean;
begin
  select case new.kind
           when 'comment' then u.notif_replies
           when 'like' then u.notif_replies
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
