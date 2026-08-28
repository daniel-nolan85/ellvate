-- Fixes found in a pre-launch review of the weekly digest feature.

-- 1) `mission_progress` has exactly one SELECT policy (0003_rls_policies_and_triggers.sql):
--    "read own progress" ... using (user_id = public.clerk_user_id())
--    The digest route (app/api/digest+api.ts) queries as the caller via RLS,
--    so digest-supabase.ts's direct `select('mission_id,user_id') from
--    mission_progress` silently returned only the *viewer's own* completions
--    in production -- missionsCompletedCount, completedMissions'
--    completedByCount (always 1), and activeMemberCount were all wrong,
--    while every test passed because they run against the in-memory store,
--    which has no RLS. This mirrors the existing toggle_post_pin (0019) /
--    bump_reply_count (0003) pattern: a narrowly-scoped SECURITY DEFINER
--    function instead of loosening the RLS policy itself, which would expose
--    every member's individual mission history to any authenticated client.
--    Capped to a 31-day window so a caller can't use it to dump full history.
create or replace function public.digest_mission_completions(
  window_start timestamptz,
  window_end timestamptz
) returns table(mission_id text, user_id text)
language plpgsql security definer set search_path = ''
as $$
begin
  if window_end - window_start > interval '31 days' then
    raise exception 'digest_mission_completions: window too wide';
  end if;

  return query
    select mp.mission_id, mp.user_id
    from public.mission_progress mp
    where mp.status = 'done'
      and mp.completed_at >= window_start
      and mp.completed_at < window_end;
end;
$$;

grant execute on function public.digest_mission_completions(timestamptz, timestamptz) to authenticated;

-- 2) send_weekly_digest: a week with zero activity still emailed/pushed every
--    opted-in member a notification reading "0 posts, 0 events, 0 missions
--    completed" (and the message never handled plural/singular correctly --
--    "1 posts, 1 events, 1 missions completed" every time any count was 1).
--    Also widens the eligibility check from exactly hour 8 to hour >= 8, so a
--    missed 8am run (a paused project, a cron hiccup) doesn't skip that
--    week's digest permanently -- the weekly_digest_runs idempotency guard
--    already makes repeat/later invocations safe.
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
  if local_hour < 8 or local_dow <> 1 then
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

  window_start := digest_week_start::timestamp at time zone 'America/Los_Angeles';
  window_end := today::timestamp at time zone 'America/Los_Angeles';

  select count(*) into post_count from public.posts
    where created_at >= window_start and created_at < window_end;
  select count(*) into event_count from public.events
    where starts_at >= window_start and starts_at < window_end;
  select count(*) into mission_count from public.mission_progress
    where status = 'done' and completed_at >= window_start and completed_at < window_end;

  -- Recording the run either way keeps this idempotent -- a dead week is
  -- marked processed even though nothing gets sent for it.
  insert into public.weekly_digest_runs (week_start) values (digest_week_start);

  if post_count = 0 and event_count = 0 and mission_count = 0 then
    return;
  end if;

  insert into public.notifications (user_id, kind, title, body, data)
  select
    u.id,
    'digest',
    'Your weekly recap is ready',
    post_count || case when post_count = 1 then ' post, ' else ' posts, ' end ||
      event_count || case when event_count = 1 then ' event, ' else ' events, ' end ||
      mission_count || case when mission_count = 1 then ' mission' else ' missions' end ||
      ' completed last week — see what''s coming up.',
    jsonb_build_object('weekStart', digest_week_start)
  from public.app_users u
  where u.notif_digest = true;
end;
$$;

-- 3) notif_digest defaulted to false until 0039_fix_notif_digest_default.sql
--    (which only changed the default for rows inserted from that point on).
--    Nobody has ever seen the digest toggle yet -- so unlike a real user's
--    later choice, a false value on a row with no completed onboarding can
--    only be the stale default, not an actual opt-out. Backfilling now, in
--    this pre-launch window, is safe in a way it wouldn't be once real users
--    exist.
update app_users set notif_digest = true where onboarded_at is null and notif_digest = false;
