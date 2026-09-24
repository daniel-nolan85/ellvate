-- Business directory: local businesses (restaurants, bars, shops, hospitality)
-- self-manage their own listing -- hours, a current special, photos -- for
-- the community to see. Mirrors service_listings (0020) for the listing
-- shape, but businesses are fixed-location (an `address`, not a mobile
-- `service_area`) and carry a `verification_status` gate that
-- service_listings never needed: this is the app's first feature where
-- content claims to speak *for* a real-world business rather than just
-- being a personal recommendation, so a listing isn't visible to anyone but
-- its creator until verification clears (see verification_status below).
-- `current_special` is a single flat column, replaced on every edit, not a
-- separate table -- the product decision here is one active special per
-- business, not a running feed of promotional posts.
--
-- Categories are a deliberately separate set from service_listings' own
-- category check -- 'professional-trade' instead of reusing the word
-- "services", since this directory tab shows both a Services section and a
-- Businesses section side by side and a chip literally reading "Services"
-- inside the Businesses section would be confusing.

create table business_listings (
  id text primary key default gen_random_uuid()::text,
  created_by text not null references app_users(id) on delete cascade,
  business_name text not null,
  category text not null check (
    category in ('restaurants-bars', 'goods', 'hospitality', 'professional-trade')
  ),
  description text not null,
  contact_phone text,
  contact_email text,
  contact_website text,
  address text,
  hours text,
  current_special text,
  special_updated_at timestamptz,
  logo jsonb,
  media jsonb,

  -- 'pending': saved, visible only to created_by. 'verified': public.
  -- No 'rejected' state -- rejection is deletion (DELETABLE_CONTENT in the
  -- admin app), matching how every other report-resolution flow in this
  -- app already works.
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified')),
  verification_method text
    check (verification_method is null or verification_method in ('domain_match', 'ai_auto', 'admin_manual')),
  -- Populated only on the assisted verification tier when it routes to an
  -- admin (Claude's reasoning for why it didn't auto-clear the listing).
  -- Null for domain_match and ai_auto, where there's nothing for a human to
  -- read, and null while still unreviewed via any tier.
  verification_notes text,
  verified_at timestamptz,
  -- Set equal to created_by at the moment verification_status flips to
  -- 'verified', by whichever method. Exists as a distinct column (rather
  -- than just reading created_by) so a future "transfer claim" flow has
  -- somewhere to record a change of operator without a schema change; v1
  -- has no such UI -- an ownership dispute is handled by deleting the
  -- disputed listing and letting the rightful operator recreate it.
  claimed_by text references app_users(id) on delete set null,

  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index business_listings_created_idx on business_listings (created_at desc);
create index business_listings_category_idx on business_listings (category);
create index business_listings_status_idx on business_listings (verification_status);

alter table business_listings enable row level security;

grant select on business_listings to anon, authenticated;
grant insert, update, delete on business_listings to authenticated;

-- Public sees only verified listings; the owner also sees their own
-- pending one (so they can watch it move from "Pending review" to live).
create policy "read business_listings" on business_listings for select to anon, authenticated
  using (verification_status = 'verified' or created_by = public.clerk_user_id());
create policy "insert own business_listing" on business_listings for insert to authenticated
  with check (created_by = public.clerk_user_id());
create policy "update own business_listing" on business_listings for update to authenticated
  using (created_by = public.clerk_user_id())
  with check (created_by = public.clerk_user_id());
create policy "delete own business_listing" on business_listings for delete to authenticated
  using (created_by = public.clerk_user_id());

-- Widen bookmarks (0013, last widened for petitions in 0051) to allow
-- bookmarking a business listing. `create or replace function` fully
-- replaces the function body, so this carries forward every existing case
-- rather than only adding the new one.
alter table bookmarks drop constraint if exists bookmarks_target_type_check;
alter table bookmarks add constraint bookmarks_target_type_check
  check (target_type in ('post', 'event', 'mission', 'service', 'petition', 'business'));

create or replace function public.toggle_bookmark(p_target_type text, p_target_id text)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user_id text := public.clerk_user_id();
  v_deleted_id text;
  v_target_exists boolean;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_target_type not in ('post', 'event', 'mission', 'service', 'petition', 'business') then
    raise exception 'invalid_target';
  end if;

  delete from public.bookmarks
    where user_id = v_user_id
      and target_type = p_target_type
      and target_id = p_target_id
    returning id into v_deleted_id;

  if v_deleted_id is not null then
    return false;
  end if;

  v_target_exists := case p_target_type
    when 'post' then exists (select 1 from public.posts where id = p_target_id)
    when 'event' then exists (select 1 from public.events where id = p_target_id)
    when 'mission' then exists (select 1 from public.missions where id = p_target_id)
    when 'service' then exists (select 1 from public.service_listings where id = p_target_id)
    when 'petition' then exists (select 1 from public.petitions where id = p_target_id)
    when 'business' then exists (select 1 from public.business_listings where id = p_target_id)
    else false
  end;
  if not v_target_exists then
    raise exception 'target_not_found';
  end if;

  begin
    insert into public.bookmarks (user_id, target_type, target_id)
    values (v_user_id, p_target_type, p_target_id);
  exception when unique_violation then
    return true;
  end;

  return true;
end;
$$;

-- Widen media Storage ownership (0007) to cover a "business-listings"
-- object-key folder.
--
-- This also FIXES A LIVE BUG, unrelated to this feature: migration 0053
-- rewrote this function (to add the 'report-evidence' case) and its
-- `create or replace` only carried forward 'avatars' / 'posts' / 'events' /
-- 'missions' -- silently dropping the 'services' case that 0020 added and
-- the 'petitions' case that 0047 later added on top of it. 0058/0059 then
-- each did their own `create or replace` on top of 0053's already-short
-- version without noticing. Every migration since 0053 has therefore been
-- missing 'services' and 'petitions', meaning service-listing logo/photo
-- uploads and petition photo uploads have been failing Storage's RLS
-- insert check in production. This `create or replace` restores both
-- alongside the new 'business-listings' case -- verified against every
-- prior version of this function (0007, 0020, 0025, 0044, 0047, 0053,
-- 0058, 0059) before writing this list.
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
