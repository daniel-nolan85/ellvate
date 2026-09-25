-- Business listing reviews: neighbors leave star ratings on a business
-- listing, mirroring service_reviews (0020) for the review/report table
-- shape -- rating + optional body, one review per (listing, author), and a
-- reports table with reason/details/evidence_image_url baked in from the
-- start (the current post-0053 shape, matching how business_listing_reports
-- (0067) was itself built fresh rather than retrofitted).
--
-- One deliberate difference from service_reviews: business_listings gates
-- visibility on verification_status (0066) -- a pending listing is visible
-- only to its own creator (see 0066's read policy). service_reviews' read
-- policy is a blanket `using (true)` because service_listings carries no
-- such gate; here the read policy instead re-checks the parent listing's
-- own visibility, so a review on a still-pending listing can't leak through
-- this table's own RLS even though business_listing_reviews itself has no
-- verification_status of its own to gate on.
--
-- No owns_media_object() case needed: like service_reviews, a review has no
-- media/photo column of its own -- confirmed against 0020, which added no
-- such case for service_reviews either.

create table business_listing_reviews (
  id text primary key default gen_random_uuid()::text,
  listing_id text not null references business_listings(id) on delete cascade,
  author_id text not null references app_users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  -- Nullable: a rating alone is a complete review, text is optional.
  body text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  -- Backstops the app-layer duplicate-review check under concurrent
  -- requests: one review per (listing, author).
  unique (listing_id, author_id)
);
create index business_listing_reviews_listing_created_idx on business_listing_reviews (listing_id, created_at desc);

create table business_listing_review_reports (
  id text primary key default gen_random_uuid()::text,
  business_listing_review_id text not null references business_listing_reviews(id) on delete cascade,
  reporter_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  reason text check (
    reason is null or reason in (
      'spam', 'harassment', 'inappropriate_content', 'scam_or_fraud',
      'impersonation', 'other'
    )
  ),
  details text,
  evidence_image_url text,
  unique (business_listing_review_id, reporter_id)
);

alter table business_listing_reviews enable row level security;
alter table business_listing_review_reports enable row level security;

grant select on business_listing_reviews, business_listing_review_reports to anon, authenticated;
grant insert, update, delete on business_listing_reviews to authenticated;
grant insert on business_listing_review_reports to authenticated;

-- Scoped to the parent listing's own visibility (see comment above) --
-- deliberately NOT a blanket `using (true)` like service_reviews' read
-- policy, since business_listings (unlike service_listings) hides a pending
-- listing from everyone but its own creator.
create policy "read business_listing_reviews" on business_listing_reviews for select to anon, authenticated
  using (
    exists (
      select 1 from public.business_listings bl
      where bl.id = business_listing_reviews.listing_id
        and (bl.verification_status = 'verified' or bl.created_by = public.clerk_user_id())
    )
  );
create policy "insert own business_listing_review" on business_listing_reviews for insert to authenticated
  with check (author_id = public.clerk_user_id());
create policy "update own business_listing_review" on business_listing_reviews for update to authenticated
  using (author_id = public.clerk_user_id())
  with check (author_id = public.clerk_user_id());
create policy "delete own business_listing_review" on business_listing_reviews for delete to authenticated
  using (author_id = public.clerk_user_id());

create policy "read own business listing review reports" on business_listing_review_reports for select to authenticated
  using (reporter_id = public.clerk_user_id());
create policy "insert own business listing review report" on business_listing_review_reports for insert to authenticated
  with check (reporter_id = public.clerk_user_id());
