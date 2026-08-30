-- Adds photo upload support to petitions (e.g. a photo showing why a
-- lighting/maintenance petition is needed), mirroring events/missions/
-- services: a jsonb media column on the row plus a 'petitions' case in
-- owns_media_object() so the Storage insert policy lets a petition's
-- creator upload to its folder.
--
-- `create or replace function` fully replaces the function body, so this
-- carries forward every existing case from 0044_restore_service_listing_
-- media_ownership.sql rather than only adding the new one -- see that
-- migration's comment for the 0025 regression this pattern exists to avoid.
alter table public.petitions add column if not exists media jsonb;

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
    when 'petitions' then exists (
      select 1 from public.petitions where id = entity_id and created_by = public.clerk_user_id()
    )
    else false
  end;
end;
$$;
