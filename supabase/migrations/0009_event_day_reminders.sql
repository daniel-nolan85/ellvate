-- Daily reminder for events happening today. Unlike the comment/reply
-- notifications, nothing a user does triggers this — it runs on a schedule
-- via pg_cron, so it lives entirely here rather than needing new app code.
-- Reuses the existing `deliver_push` trigger (0005) for the actual push send,
-- and is scoped to users who have the `events` notification category
-- enabled (a broadcast digest like this is opt-in-by-category, unlike a
-- personal reply notification, which always creates its in-app row
-- regardless of push preference).

alter table events add column if not exists reminder_sent_at timestamptz;

create or replace function public.send_event_day_reminders() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  ev record;
begin
  for ev in
    select id, title, time_label, place
    from public.events
    where reminder_sent_at is null
      and starts_at >= date_trunc('day', now())
      and starts_at < date_trunc('day', now()) + interval '1 day'
  loop
    insert into public.notifications (user_id, kind, title, body, data)
    select
      u.id,
      'event',
      'Today: ' || ev.title,
      ev.time_label || ' at ' || ev.place,
      jsonb_build_object('eventId', ev.id)
    from public.app_users u
    where u.notif_events = true;

    update public.events set reminder_sent_at = now() where id = ev.id;
  end loop;
end;
$$;

-- WHY: pg_cron schedules run in UTC. '0 15 * * *' targets ~8am Pacific
-- (Lake Las Vegas, NV) outside DST — adjust the hour for your deployment's
-- desired local morning time / DST handling.
create extension if not exists pg_cron;

select cron.schedule(
  'event-day-reminders',
  '0 15 * * *',
  $$ select public.send_event_day_reminders(); $$
);
