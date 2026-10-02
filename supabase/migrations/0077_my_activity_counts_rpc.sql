-- My Activity's stat tiles (ActivityStatPanel) used to compute every count
-- client-side as the length of the *currently fetched* page of its own
-- infinite-scroll query (page size 20) -- correct once every page has been
-- fetched, but wrong (stuck at 20) until the member actually scrolls far
-- enough to trigger every subsequent page. This RPC gives the real,
-- unpaginated total in one round trip, the same way member_activity_counts
-- (0062) already does for public member-profile stats -- collapsing what
-- would otherwise be several separate head-count queries into one, for the
-- same "too many subrequests per Worker invocation" reason documented
-- there.
--
-- Deliberately scoped to the caller (via clerk_user_id(), no parameter)
-- rather than mirroring member_activity_counts' member_id parameter --
-- this is "my own" activity, never looked up for anyone else, so there's no
-- reason to accept or trust a caller-supplied id.
--
-- Three counts need different logic than a plain per-table count(*):
--   * events_attending excludes the caller's own authored events they also
--     joined (matches activity-screen.tsx's `going` flag, which excludes
--     self-authorship the same way) -- member_activity_counts' own
--     events_attended does NOT do this exclusion, so it can't be reused
--     here without changing that screen's own semantics.
--   * petitions_count unions petitions the caller created with petitions
--     they merely signed, deduped -- matching getMyPetitionsViewSupabase's
--     own "mine" definition (petitions.test.ts), not member_activity_counts'
--     petitions_started, which is created-only.
--   * missions_completed reads app_users.missions_completed directly
--     (the same counter the Leaderboard reads, kept accurate by
--     missions-supabase.ts's check-in increment and 0075's revoke-on-delete
--     decrement) rather than counting mission_progress rows -- it's already
--     the app's single source of truth for this number, and reading it
--     directly means one less subquery. Note this counter is itself
--     "best-effort" (see missions-supabase.ts) -- a rare transient failure
--     right after a completion's XP grant could leave it briefly one behind
--     the true mission_progress count, self-correcting on the next
--     completion.
create or replace function public.my_activity_counts()
returns table(
  posts_count bigint,
  events_created bigint,
  events_attending bigint,
  missions_created bigint,
  missions_completed bigint,
  services_listed bigint,
  petitions_count bigint
)
language sql stable security invoker set search_path = ''
as $$
  select
    (select count(*) from public.posts where author_id = public.clerk_user_id()),
    (select count(*) from public.events where created_by = public.clerk_user_id()),
    (
      select count(*)
      from public.event_joins ej
      join public.events e on e.id = ej.event_id
      where ej.user_id = public.clerk_user_id() and e.created_by <> public.clerk_user_id()
    ),
    (select count(*) from public.missions where created_by = public.clerk_user_id()),
    (select coalesce(missions_completed, 0) from public.app_users where id = public.clerk_user_id()),
    (select count(*) from public.service_listings where created_by = public.clerk_user_id()),
    (
      select count(*) from (
        select id from public.petitions where created_by = public.clerk_user_id()
        union
        select petition_id as id from public.petition_signatures where user_id = public.clerk_user_id()
      ) mine
    )
$$;

grant execute on function public.my_activity_counts() to authenticated;
