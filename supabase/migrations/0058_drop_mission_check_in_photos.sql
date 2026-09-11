-- Mission check-in photos are no longer persisted or shown to anyone: they're
-- scanned in memory for a face (src/services/face-detection) at the
-- completing check-in and discarded either way. Check-in reporting existed
-- specifically to moderate those publicly-visible photos, so it goes with
-- them -- there's nothing left to report.
drop table if exists mission_check_in_reports;
alter table mission_check_ins drop column if exists photo_url;

-- Check-in photo uploads to the 'mission-checkins' Storage folder no longer
-- happen at all -- drop that case from the ownership check (see 0025) so it
-- fails closed rather than staying around as a live but unused pathway.
create or replace function public.owns_media_object(object_name text) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  parts text[];
  folder text;
  entity_id text;
begin
  parts := string_to_array(object_name, '/');
  if array_length(parts, 1) < 2 then
    return false;
  end if;
  folder := parts[1];
  entity_id := parts[2];

  return case folder
    when 'avatars' then entity_id = public.clerk_user_id()
    when 'posts' then exists (
      select 1 from public.posts where id = entity_id and author_id = public.clerk_user_id()
    )
    when 'events' then exists (
      select 1 from public.events where id = entity_id and created_by = public.clerk_user_id()
    )
    when 'missions' then exists (
      select 1 from public.missions where id = entity_id and created_by = public.clerk_user_id()
    )
    else false
  end;
end;
$$;
