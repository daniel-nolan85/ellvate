-- Notify an event's creator when someone comments on it, mirroring
-- `notify_post_author` (0003) for posts. Uses kind 'event' so it maps to the
-- same `notif_events` preference the push-delivery trigger (0005) checks.

create or replace function public.notify_event_author() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  author text;
  event_title text;
  commenter_name text;
begin
  select e.created_by, e.title into author, event_title
    from public.events e where e.id = new.event_id;
  if author is null or author = new.author_id then
    return new;
  end if;
  select u.name into commenter_name from public.app_users u where u.id = new.author_id;
  insert into public.notifications (user_id, kind, title, body, data)
  values (
    author,
    'event',
    'New comment on your event',
    coalesce(commenter_name, 'Someone') || ' commented on "' || event_title || '"',
    jsonb_build_object('eventId', new.event_id, 'commentId', new.id)
  );
  return new;
end;
$$;

create trigger event_comments_notify_author
after insert on event_comments
for each row execute function public.notify_event_author();
