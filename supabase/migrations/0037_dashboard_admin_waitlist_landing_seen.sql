-- Unseen-count tracking for the admin dashboard's new Waitlist page and the
-- Contact page's new "Landing page" tab, mirroring 0031's
-- reports_last_seen_at / contact_messages_last_seen_at columns exactly.

alter table dashboard_admins add column if not exists waitlist_last_seen_at timestamptz;
alter table dashboard_admins add column if not exists landing_contact_last_seen_at timestamptz;
