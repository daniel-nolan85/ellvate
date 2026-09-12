-- Streak was a naive +1-per-check-in counter with no calendar logic (no
-- reset for missed days), so it didn't actually track a "streak" in any way
-- that would hold up to what the label promised. Removing it outright
-- rather than leaving a misleading stat on profiles.
alter table app_users drop column streak_days;
