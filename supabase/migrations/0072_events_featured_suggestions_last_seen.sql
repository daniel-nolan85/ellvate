-- Nav-badge "seen" tracking for the admin Events page's featured-event
-- suggestions callout, same pattern as business_listings_last_seen_at
-- (0068) and reports/contact/waitlist before it.

alter table dashboard_admins
  add column if not exists events_featured_suggestions_last_seen_at timestamptz;
