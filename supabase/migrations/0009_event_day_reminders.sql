-- Daily reminder for events happening today. Unlike the comment/reply
-- notifications, nothing a user does triggers this — it runs on a schedule
-- via pg_cron, so it lives entirely here rather than needing new app code.
-- Reuses the existing `deliver_push` trigger (0005) for the actual push send.
-- Recipients are the event's creator plus anyone who joined it (each still
-- gated on their own `notif_events` preference) — this is a reminder about an
-- event you're connected to, not a broadcast to every member with the
-- category enabled.

alter table events add column if not exists reminder_sent_at timestamptz;

-- WHY `check_time` is a parameter, not a bare `now()`: pg_cron only runs in
-- UTC and Supabase's pg_cron version has no reliable per-job timezone, but
-- Lake Las Vegas (NV) observes DST. Rather than a fixed UTC cron hour, the
-- job below fires every hour and this function only proceeds once local
-- time in America/Los_Angeles is actually the target morning hour — correct
-- across both PDT and PST since `at time zone` uses IANA tzdata. Taking the
-- reference time as a parameter (defaulting to `now()`) also makes the
-- function directly testable for both offsets without manipulating the
-- server clock.
create or replace function public.send_event_day_reminders(
  check_time timestamptz default now()
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  ev record;
  local_hour int;
begin
  local_hour := extract(hour from check_time at time zone 'America/Los_Angeles');
  if local_hour <> 8 then
    return;
  end if;

  for ev in
    select id, title, time_label, place, created_by
    from public.events
    where reminder_sent_at is null
      and starts_at >= date_trunc('day', check_time)
      and starts_at < date_trunc('day', check_time) + interval '1 day'
  loop
    insert into public.notifications (user_id, kind, title, body, data)
    select
      recipient.user_id,
      'event',
      'Today: ' || ev.title,
      ev.time_label || ' at ' || ev.place,
      jsonb_build_object('eventId', ev.id)
    from (
      select ev.created_by as user_id
      where ev.created_by is not null
      union
      select ej.user_id from public.event_joins ej where ej.event_id = ev.id
    ) recipient
    join public.app_users u on u.id = recipient.user_id
    where u.notif_events = true;

    update public.events set reminder_sent_at = now() where id = ev.id;
  end loop;
end;
$$;

create extension if not exists pg_cron;

select cron.schedule(
  'event-day-reminders',
  '0 * * * *',
  $$ select public.send_event_day_reminders(); $$
);

-- Rescheduling an event to a different day must not permanently suppress its
-- reminder — the marker only means "already reminded for the day it was
-- pointed at", so it has to clear whenever that day changes.
create or replace function public.reset_event_reminder_on_reschedule() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if date_trunc('day', new.starts_at) is distinct from date_trunc('day', old.starts_at) then
    new.reminder_sent_at := null;
  end if;
  return new;
end;
$$;

create trigger events_reset_reminder_on_reschedule
before update on events
for each row execute function public.reset_event_reminder_on_reschedule();
