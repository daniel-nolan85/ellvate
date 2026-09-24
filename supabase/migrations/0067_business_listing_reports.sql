-- Report a business listing directly (not a review -- businesses have no
-- reviews). Mirrors mission_check_in_photo_reports' (0059) shape: built
-- fresh with reason/details/evidence_image_url baked in from the start,
-- the current (post-0053) report-table shape, not the older bare shape
-- some tables grew into over several migrations.

create table business_listing_reports (
  id text primary key default gen_random_uuid()::text,
  business_listing_id text not null references business_listings(id) on delete cascade,
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
  unique (business_listing_id, reporter_id)
);

alter table business_listing_reports enable row level security;

grant select, insert on business_listing_reports to authenticated;

create policy "read own business listing reports" on business_listing_reports for select to authenticated
  using (reporter_id = public.clerk_user_id());
create policy "insert own business listing report" on business_listing_reports for insert to authenticated
  with check (reporter_id = public.clerk_user_id());

-- No owns_media_object change needed here: evidence uploads reuse the
-- already-existing 'report-evidence' folder case.
