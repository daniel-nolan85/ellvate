-- Services directory: residents list a business (listings) and neighbors
-- leave star ratings (reviews). Mirrors missions (0001) for the listing
-- table shape and mission_comments (0017) for the review/report shape, with
-- a rating column added. Average rating/review count are computed at read
-- time in the app layer rather than stored denormalized on the listing.

create table service_listings (
  id text primary key default gen_random_uuid()::text,
  created_by text not null references app_users(id) on delete cascade,
  business_name text not null,
  category text not null check (
    category in ('pet-care', 'home-services', 'beauty', 'automotive', 'pool-spa', 'tech-web', 'dining', 'other')
  ),
  description text not null,
  contact_phone text,
  contact_email text,
  contact_website text,
  service_area text,
  hours text,
  logo jsonb,
  media jsonb,
  created_at timestamptz not null default now()
);
create index service_listings_created_idx on service_listings (created_at desc);
create index service_listings_category_idx on service_listings (category);

create table service_reviews (
  id text primary key default gen_random_uuid()::text,
  listing_id text not null references service_listings(id) on delete cascade,
  author_id text not null references app_users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  -- Nullable: a rating alone is a complete review, text is optional.
  body text,
  created_at timestamptz not null default now(),
  -- Backstops the app-layer duplicate-review check under concurrent
  -- requests: one review per (listing, author).
  unique (listing_id, author_id)
);
create index service_reviews_listing_created_idx on service_reviews (listing_id, created_at desc);

create table service_review_reports (
  id text primary key default gen_random_uuid()::text,
  service_review_id text not null references service_reviews(id) on delete cascade,
  reporter_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (service_review_id, reporter_id)
);

alter table service_listings enable row level security;
alter table service_reviews enable row level security;
alter table service_review_reports enable row level security;

grant select on service_listings, service_reviews, service_review_reports to anon, authenticated;
grant insert, update, delete on service_listings to authenticated;
grant insert, update, delete on service_reviews to authenticated;
grant insert on service_review_reports to authenticated;

-- service_listings: public read (it's a directory), owner-only writes.
create policy "read service_listings" on service_listings for select to anon, authenticated using (true);
create policy "insert own service_listing" on service_listings for insert to authenticated
  with check (created_by = public.clerk_user_id());
create policy "update own service_listing" on service_listings for update to authenticated
  using (created_by = public.clerk_user_id())
  with check (created_by = public.clerk_user_id());
create policy "delete own service_listing" on service_listings for delete to authenticated
  using (created_by = public.clerk_user_id());

-- service_reviews: public read, author-owned writes (mirrors mission_comments in 0017).
create policy "read service_reviews" on service_reviews for select to anon, authenticated using (true);
create policy "insert own service_review" on service_reviews for insert to authenticated
  with check (author_id = public.clerk_user_id());
create policy "update own service_review" on service_reviews for update to authenticated
  using (author_id = public.clerk_user_id())
  with check (author_id = public.clerk_user_id());
create policy "delete own service_review" on service_reviews for delete to authenticated
  using (author_id = public.clerk_user_id());

create policy "read own service review reports" on service_review_reports for select to authenticated
  using (reporter_id = public.clerk_user_id());
create policy "insert own service review report" on service_review_reports for insert to authenticated
  with check (reporter_id = public.clerk_user_id());

-- Widen bookmarks (0013) to allow bookmarking a service listing.
alter table bookmarks drop constraint if exists bookmarks_target_type_check;
alter table bookmarks add constraint bookmarks_target_type_check
  check (target_type in ('post', 'event', 'mission', 'service'));

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
  if p_target_type not in ('post', 'event', 'mission', 'service') then
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

-- Widen media Storage ownership (0007) to cover the "services" object-key
-- folder, so a direct Storage API call (bypassing the app layer) for a
-- listing photo is still rejected for anyone but that listing's owner.
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
    when 'services' then exists (
      select 1 from public.service_listings where id = entity_id and created_by = public.clerk_user_id()
    )
    else false
  end;
end;
$$;
