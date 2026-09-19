-- 0021_activity_privacy.sql shipped this column defaulting to false
-- (private), on the stated intent that "other members see only figures
-- until this member turns sharing on." That's backwards from the actual
-- product intent: a member's detailed activity should be visible by
-- default, hidden only if they explicitly opt out via Profile > Privacy >
-- "Share activity". Every new app_users row is created via a bare
-- `upsert({ id, name })` (see ensureUser in profile-supabase.ts), so it
-- always picks up this column default -- flipping it here is sufficient to
-- fix new signups without touching any existing row's explicit choice.
alter table app_users alter column activity_visible set default true;
