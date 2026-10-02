-- events_attending used to exclude a member's own events entirely (even if
-- they explicitly tapped "Join event" on something they created themselves)
-- -- intentional originally (an organizer isn't automatically "attending"
-- their own event just by having made it), but the explicit, deliberate act
-- of tapping Join should count, by request: a member who creates an event
-- and then marks themselves going should see that reflected in "Events
-- attending", not silently dropped.
--
-- Events created/attending are therefore no longer mutually exclusive --
-- the same event can now count toward both (mirrors how a mission a member
-- created and later completed themselves already counts toward both
-- missionsCreatedCount and missionsCompletedCount). So this also adds
-- events_count, the deduped created-OR-joined union, the same way 0079
-- added missions_count -- the Events section's own row-count badge needs
-- this instead of eventsCreatedCount + eventsAttendingCount, which can now
-- overcount a self-created-and-joined event.
--
-- Changing a function's OUT columns needs drop + create, not create or
-- replace.
drop function if exists public.my_activity_counts();

create function public.my_activity_counts()
returns table(
  posts_count bigint,
  events_created bigint,
  events_attending bigint,
  events_count bigint,
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
    (select count(*) from public.event_joins where user_id = public.clerk_user_id()),
    (
      select count(*) from (
        select id from public.events where created_by = public.clerk_user_id()
        union
        select event_id as id from public.event_joins where user_id = public.clerk_user_id()
      ) mine
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
