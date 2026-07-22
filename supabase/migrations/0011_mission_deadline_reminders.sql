-- Daily reminder for missions a user is actively working on that are
-- scheduled for today, mirroring 0009's event-day-reminder job. Scoped to
-- `mission_progress.status = 'active'` — only users who've actually started
-- the mission (not everyone eligible to start it), matching "a mission
-- they're working on" rather than a broadcast to all users.

alter table mission_progress add column if not exists reminder_sent_at timestamptz;

-- WHY `check_time` is a parameter, not a bare `now()`: see 0009 for the full
-- rationale — pg_cron only runs in UTC, so the DST-correct local hour check
-- and the every-hour cron schedule below mirror that migration exactly.
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
    where mp.status = 'active'
      and mp.reminder_sent_at is null
      and m.scheduled_for = today
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

select cron.schedule(
  'mission-deadline-reminders',
  '0 * * * *',
  $$ select public.send_mission_deadline_reminders(); $$
);

-- Rescheduling a mission to a different day must not permanently suppress
-- its reminder for everyone tracking it — reset every progress row's marker
-- for that mission whenever `scheduled_for` changes.
create or replace function public.reset_mission_reminder_on_reschedule() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.scheduled_for is distinct from old.scheduled_for then
    update public.mission_progress
    set reminder_sent_at = null
    where mission_id = new.id;
  end if;
  return new;
end;
$$;

create trigger missions_reset_reminder_on_reschedule
after update on missions
for each row execute function public.reset_mission_reminder_on_reschedule();
