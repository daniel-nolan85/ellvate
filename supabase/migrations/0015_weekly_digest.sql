-- Weekly digest: an automated Monday-morning notification recapping the week
-- just completed, fanned out to every member with the digest preference on
-- (a community-wide recap, not a per-user reminder about their own content —
-- unlike the event/mission reminders, everyone gets the same notification).

-- Idempotency marker: unlike the event/mission reminders, there's no single
-- row this action naturally belongs to (it's a broadcast, not per-target), so
-- a dedicated table tracks which week's digest has already been sent.
create table if not exists weekly_digest_runs (
  week_start date primary key,
  sent_at timestamptz not null default now()
);

-- WHY `check_time` is a parameter, not a bare `now()`: see 0009 for the full
-- rationale — pg_cron only runs in UTC, so the DST-correct local hour/weekday
-- check and the every-hour cron schedule below mirror that migration's
-- pattern, extended to also gate on the day of week (Monday).
create or replace function public.send_weekly_digest(
  check_time timestamptz default now()
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  local_hour int;
  local_dow int;
  today date;
  digest_week_start date;
  window_start timestamptz;
  window_end timestamptz;
  already_sent boolean;
  post_count int;
  event_count int;
  mission_count int;
begin
  local_hour := extract(hour from check_time at time zone 'America/Los_Angeles');
  local_dow := extract(dow from check_time at time zone 'America/Los_Angeles');
  if local_hour <> 8 or local_dow <> 1 then
    return;
  end if;

  today := (check_time at time zone 'America/Los_Angeles')::date;
  digest_week_start := today - 7;

  select exists(
    select 1 from public.weekly_digest_runs where week_start = digest_week_start
  ) into already_sent;
  if already_sent then
    return;
  end if;

  -- Convert the local calendar-date boundaries back to real UTC instants
  -- (midnight Pacific, not midnight UTC) before comparing against the
  -- timestamptz columns below — `date::timestamp at time zone 'zone'`
  -- interprets the naive value as wall-clock time *in* that zone and
  -- converts it to the equivalent instant, which is the correct direction
  -- for this (the opposite of `timestamptz at time zone 'zone'` above, which
  -- extracts local wall-clock fields *from* an instant).
  window_start := digest_week_start::timestamp at time zone 'America/Los_Angeles';
  window_end := today::timestamp at time zone 'America/Los_Angeles';

  select count(*) into post_count from public.posts
    where created_at >= window_start and created_at < window_end;
  select count(*) into event_count from public.events
    where starts_at >= window_start and starts_at < window_end;
  select count(*) into mission_count from public.mission_progress
    where status = 'done' and completed_at >= window_start and completed_at < window_end;

  insert into public.notifications (user_id, kind, title, body, data)
  select
    u.id,
    'digest',
    'Your weekly recap is ready',
    post_count || ' posts, ' || event_count || ' events, ' || mission_count ||
      ' missions completed last week — see what''s coming up.',
    jsonb_build_object('weekStart', digest_week_start)
  from public.app_users u
  where u.notif_digest = true;

  insert into public.weekly_digest_runs (week_start) values (digest_week_start);
end;
$$;

select cron.schedule(
  'weekly-digest',
  '0 * * * *',
  $$ select public.send_weekly_digest(); $$
);

-- Route digest notifications through the existing push-delivery trigger
-- (0005/0010), gated on the digest preference rather than defaulting to
-- "always send" for an unrecognized kind.
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
           when 'digest' then u.notif_digest
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
