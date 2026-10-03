-- Extends send_event_day_reminders (0009) to also notify anyone who marked
-- an event "interested" (event_interests, 0082), not just its creator and
-- joiners -- interested was deliberately kept separate from going (no XP, no
-- stat, no effect on the going count/attendee roster), but a same-day
-- reminder is squarely what someone marked an event interesting FOR: they
-- said "this caught my eye," and the whole point of that is to be reminded
-- when it's actually happening. The union already dedupes, so a member who
-- is both going and interested in the same event still gets exactly one
-- reminder, not two.
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
      union
      select ei.user_id from public.event_interests ei where ei.event_id = ev.id
    ) recipient
    join public.app_users u on u.id = recipient.user_id
    where u.notif_events = true;

    update public.events set reminder_sent_at = now() where id = ev.id;
  end loop;
end;
$$;
