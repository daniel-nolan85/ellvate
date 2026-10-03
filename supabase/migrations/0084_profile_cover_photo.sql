-- A cover/banner photo for a member's profile, shown behind the avatar on
-- both their own Profile screen and the public member-profile screen others
-- see -- the same visibility split as avatar_url, not something private.
alter table app_users add column if not exists cover_url text;

-- Widens Storage ownership (0007, most recently redefined in 0066) to cover
-- a "covers" object-key folder, mirroring 'avatars' exactly (an owner-scoped
-- folder keyed by the uploader's own user id, not an entity id requiring a
-- lookup). Carries forward every existing case unchanged -- see 0066's own
-- WHY for why a `create or replace` here must enumerate the full current
-- list rather than risk silently dropping one, as 0053 once did.
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
    when 'covers' then entity_id = public.clerk_user_id()
    when 'report-evidence' then entity_id = public.clerk_user_id()
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
    when 'business-listings' then exists (
      select 1 from public.business_listings where id = entity_id and created_by = public.clerk_user_id()
    )
    else false
  end;
end;
$$;
