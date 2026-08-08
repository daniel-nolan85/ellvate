-- The notif_* preference columns (0001) were only ever consulted by
-- deliver_push (0005) to decide whether to send a push — the notification
-- ROW itself (which drives the in-app bell badge and inbox list) was always
-- inserted regardless. Turning a category off therefore did nothing visible
-- in the app; it only ever suppressed a push that this dev environment has
-- no real tokens to send anyway. Gate row creation itself on the same
-- preference each trigger already documents mapping to, so the toggle
-- actually does what its onboarding/profile copy claims.
--
-- send_mission_deadline_reminders (0011) additionally never checked
-- notif_missions at all, unlike send_event_day_reminders (0009) — the two
-- jobs should behave the same way; this brings it in line.

create or replace function public.notify_post_author() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  author text;
  post_title text;
  commenter_name text;
  wants boolean;
begin
  select p.author_id, p.title into author, post_title
    from public.posts p where p.id = new.post_id;
  if author is null or author = new.author_id then
    return new;
  end if;
  select u.notif_replies into wants from public.app_users u where u.id = author;
  if wants is distinct from true then
    return new;
  end if;
  select u.name into commenter_name from public.app_users u where u.id = new.author_id;
  insert into public.notifications (user_id, kind, title, body, data)
  values (
    author,
    'comment',
    'New reply to your post',
    coalesce(commenter_name, 'Someone') || ' commented on "' || post_title || '"',
    jsonb_build_object('postId', new.post_id, 'commentId', new.id)
  );
  return new;
end;
$$;

create or replace function public.notify_event_author() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  author text;
  event_title text;
  commenter_name text;
  wants boolean;
begin
  select e.created_by, e.title into author, event_title
    from public.events e where e.id = new.event_id;
  if author is null or author = new.author_id then
    return new;
  end if;
  select u.notif_events into wants from public.app_users u where u.id = author;
  if wants is distinct from true then
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

create or replace function public.notify_mission_author() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  author text;
  mission_title text;
  commenter_name text;
  wants boolean;
begin
  select m.created_by, m.title into author, mission_title
    from public.missions m where m.id = new.mission_id;
  if author is null or author = new.author_id then
    return new;
  end if;
  select u.notif_missions into wants from public.app_users u where u.id = author;
  if wants is distinct from true then
    return new;
  end if;
  select u.name into commenter_name from public.app_users u where u.id = new.author_id;
  insert into public.notifications (user_id, kind, title, body, data)
  values (
    author,
    'mission',
    'New comment on your mission',
    coalesce(commenter_name, 'Someone') || ' commented on "' || mission_title || '"',
    jsonb_build_object('missionId', new.mission_id, 'commentId', new.id)
  );
  return new;
end;
$$;

create or replace function public.notify_post_liker() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  author text;
  post_title text;
  liker_name text;
  wants boolean;
begin
  select p.author_id, p.title into author, post_title
    from public.posts p where p.id = new.post_id;
  if author is null or author = new.user_id then
    return new;
  end if;
  select u.notif_replies into wants from public.app_users u where u.id = author;
  if wants is distinct from true then
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

create or replace function public.send_mission_deadline_reminders(
  check_time timestamptz default now()
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  rec record;
  local_hour int;
  today date;
begin
  local_hour := extract(hour from check_time at time zone 'America/Los_Angeles');
  if local_hour <> 8 then
    return;
  end if;
  today := (check_time at time zone 'America/Los_Angeles')::date;

  for rec in
    select mp.user_id, mp.mission_id, m.title
    from public.mission_progress mp
    join public.missions m on m.id = mp.mission_id
    join public.app_users u on u.id = mp.user_id
    where mp.status = 'active'
      and mp.reminder_sent_at is null
      and m.scheduled_for = today
      and u.notif_missions = true
  loop
    insert into public.notifications (user_id, kind, title, body, data)
    values (
      rec.user_id,
      'mission',
      'Mission due today',
      '"' || rec.title || '" is scheduled for today.',
      jsonb_build_object('missionId', rec.mission_id)
    );

    update public.mission_progress
    set reminder_sent_at = now()
    where user_id = rec.user_id and mission_id = rec.mission_id;
  end loop;
end;
$$;
