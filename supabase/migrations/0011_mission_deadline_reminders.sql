-- Daily reminder for missions a user is actively working on that are
-- scheduled for today, mirroring 0009's event-day-reminder job. Scoped to
-- `mission_progress.status = 'active'` — only users who've actually started
-- the mission (not everyone eligible to start it), matching "a mission
-- they're working on" rather than a broadcast to all users.

alter table mission_progress add column if not exists reminder_sent_at timestamptz;

create or replace function public.send_mission_deadline_reminders() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  rec record;
begin
  for rec in
    select mp.user_id, mp.mission_id, m.title
    from public.mission_progress mp
    join public.missions m on m.id = mp.mission_id
    where mp.status = 'active'
      and mp.reminder_sent_at is null
      and m.scheduled_for = current_date
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

-- WHY: pg_cron schedules run in UTC — see 0009 for the same Pacific-morning
-- rationale; adjust the hour for your deployment's DST handling.
select cron.schedule(
  'mission-deadline-reminders',
  '0 15 * * *',
  $$ select public.send_mission_deadline_reminders(); $$
);
