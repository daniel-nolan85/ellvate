-- The windowed (week/month) Leaderboard used to query xp_ledger directly
-- for every member's recent completions -- but xp_ledger's own RLS policy
-- ("read own xp ledger", 0056) restricts select to each user's own rows
-- only, unlike app_users (publicly readable, which is why the all-time
-- leaderboard's direct app_users query already works). A cross-user
-- xp_ledger query under ordinary RLS would have silently returned almost
-- nothing. This mirrors the same security definer aggregation pattern
-- already used for member_activity_counts (0062) and my_activity_counts
-- (0077) for this exact class of problem: a per-member aggregate that's
-- fine to expose, computed server-side rather than widening the underlying
-- table's own RLS.
--
-- Takes both window boundaries in one call (current + the immediately
-- preceding window of equal length, needed for rankDelta) and returns one
-- row per member with activity in either window, pre-split into
-- current/previous sums -- the application code no longer needs to fetch
-- raw ledger rows and bucket them itself.
create or replace function public.windowed_xp_tally(
  p_previous_start timestamptz,
  p_current_start timestamptz
)
returns table(
  user_id text,
  current_xp bigint,
  current_missions_completed bigint,
  previous_xp bigint,
  previous_missions_completed bigint
)
language sql stable security definer set search_path = ''
as $$
  select
    coalesce(cur.user_id, prev.user_id) as user_id,
    coalesce(cur.xp, 0) as current_xp,
    coalesce(cur.missions_completed, 0) as current_missions_completed,
    coalesce(prev.xp, 0) as previous_xp,
    coalesce(prev.missions_completed, 0) as previous_missions_completed
  from (
    select
      user_id,
      sum(amount) as xp,
      count(*) filter (where reason = 'mission_completed') as missions_completed
    from public.xp_ledger
    where created_at >= p_current_start
    group by user_id
  ) cur
  full outer join (
    select
      user_id,
      sum(amount) as xp,
      count(*) filter (where reason = 'mission_completed') as missions_completed
    from public.xp_ledger
    where created_at >= p_previous_start and created_at < p_current_start
    group by user_id
  ) prev on prev.user_id = cur.user_id
$$;

grant execute on function public.windowed_xp_tally(timestamptz, timestamptz) to authenticated;
