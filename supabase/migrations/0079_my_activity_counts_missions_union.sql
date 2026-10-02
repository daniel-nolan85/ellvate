-- my_activity_counts (0077) gave each stat tile its true, unpaginated
-- total, but the Missions section's own header badge (SectionHeader's
-- count, in activity-screen.tsx) still used the fetched page's own length
-- -- the same "20 instead of 23" bug 0077 fixed for the tiles above it,
-- just not yet for this one spot.
--
-- Unlike Events (created/attending are mutually exclusive by construction,
-- so eventsCreatedCount + eventsAttendingCount already equals the row
-- count), Missions are NOT: a mission a member created and later completed
-- themselves renders as exactly one row in the list but counts toward BOTH
-- missionsCreatedCount and missionsCompletedCount, so simply adding those
-- two would overcount. missions_count below is the deduped union --
-- mirrors petitions_count's own created-OR-signed union in 0077 -- matching
-- getMyMissionsViewMemory/getMyMissionsViewSupabase's own "mine" row set
-- exactly (authored OR completed).
--
-- Changing a function's OUT columns needs drop + create, not create or
-- replace.
drop function if exists public.my_activity_counts();

create function public.my_activity_counts()
returns table(
  posts_count bigint,
  events_created bigint,
  events_attending bigint,
  missions_created bigint,
  missions_completed bigint,
  missions_count bigint,
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
    (
      select count(*) from (
        select id from public.missions where created_by = public.clerk_user_id()
        union
        select mission_id as id from public.mission_progress
        where user_id = public.clerk_user_id() and status = 'done'
      ) mine
    ),
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
