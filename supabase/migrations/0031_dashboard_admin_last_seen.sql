-- Per-admin "last viewed" timestamps backing unread-style badge counts in
-- the dashboard nav (Reports, Contact). Direct nullable columns on
-- dashboard_admins rather than a join table: only two sections need this
-- today, and every request already has the signed-in admin's row (looked
-- up by email via auth.getUser()), so no join is required to read it.

alter table dashboard_admins add column if not exists reports_last_seen_at timestamptz;
alter table dashboard_admins add column if not exists contact_messages_last_seen_at timestamptz;
