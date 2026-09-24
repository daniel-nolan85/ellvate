-- Unseen-count badge for the admin business-listings queue, mirrors
-- reports_last_seen_at / contact_messages_last_seen_at (0031) exactly.

alter table dashboard_admins add column if not exists business_listings_last_seen_at timestamptz;
