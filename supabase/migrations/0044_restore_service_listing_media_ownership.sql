-- Restores the 'services' case that 0020_service_listings.sql added to
-- owns_media_object() (so a service listing's owner can upload/replace its
-- logo/media via Storage) but 0025_mission_checkins.sql's own
-- `create or replace function` silently dropped when it added the
-- 'mission-checkins' case: each `create or replace` fully replaces the
-- function body, so 0025 needed to carry every existing case forward and
-- didn't. Since then, every service-listing photo/logo upload has hit the
-- Storage insert policy's `owns_media_object(name)` check, fallen through to
-- `else false`, and been silently rejected -- the create/edit form's own
-- upload call fails with no listing photo ever saving.
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
    when 'mission-checkins' then entity_id = public.clerk_user_id()
    when 'posts' then exists (
      select 1 from public.posts where id = entity_id and author_id = public.clerk_user_id()
    )
    when 'events' then exists (
      select 1 from public.events where id = entity_id and created_by = public.clerk_user_id()
    )
    when 'missions' then exists (
      select 1 from public.missions where id = entity_id and created_by = public.clerk_user_id()
    )
    when 'services' then exists (
      select 1 from public.service_listings where id = entity_id and created_by = public.clerk_user_id()
    )
    else false
  end;
end;
$$;
