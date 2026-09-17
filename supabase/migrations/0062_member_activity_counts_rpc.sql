-- Collapses the 6 separate head-count queries
-- getMemberActivityCountsSupabase fired per member-profile view (posts,
-- missions created, events created, events attended, services listed,
-- petitions started) into a single round trip. Combined with the other
-- queries getPublicProfile makes (the member row, missions + mission_progress
-- + user row + progress counts for getMissionsView), member profiles were
-- firing 11 Supabase subrequests in one request -- see missions-supabase.ts's
-- MISSION_SELECT comment for the exact "Too many subrequests by single
-- Worker invocation" failure this class of fix already exists for. All six
-- source tables here are already publicly readable (see their own "read ..."
-- policies), so this needs no elevated privilege -- security invoker, not
-- definer, unlike digest_mission_completions.
create or replace function public.member_activity_counts(member_id text)
returns table(
  posts_count bigint,
  missions_created bigint,
  events_created bigint,
  events_attended bigint,
  services_listed bigint,
  petitions_started bigint
)
language sql stable security invoker set search_path = ''
as $$
  select
    (select count(*) from public.posts where author_id = member_id),
    (select count(*) from public.missions where created_by = member_id),
    (select count(*) from public.events where created_by = member_id),
    (select count(*) from public.event_joins where user_id = member_id),
    (select count(*) from public.service_listings where created_by = member_id),
    (select count(*) from public.petitions where created_by = member_id)
$$;

grant execute on function public.member_activity_counts(text) to anon, authenticated;
