-- The weekly digest is the only place in the app that queries these columns
-- by a plain date/timestamp range with no other leading filter (every other
-- caller of comments/events/mission_progress scopes by post_id/event_id/
-- status first, which the existing composite indexes already cover). Without
-- a supporting index, each of these becomes a full sequential scan that gets
-- slower as the table grows -- a plausible contributor to "Weekly Recap
-- loads for a long time, then errors" as real production data accumulates.
create index if not exists comments_created_idx on public.comments (created_at);
create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists mission_progress_completed_idx
  on public.mission_progress (status, completed_at)
  where status = 'done';
