-- Fixes a real, live security gap flagged by Supabase's security advisor:
-- three tables were created without ever running `enable row level
-- security`, so Postgres never enforces any of their access rules.
--
-- event_reports / mission_reports (0046_event_and_mission_reports.sql):
-- correct owner-scoped SELECT/INSERT policies were written, but the
-- migration never turned RLS on for either table -- Postgres silently
-- ignores every policy on a table until RLS is enabled for it, so any
-- authenticated user could read every other user's reports and insert rows
-- with a forged reporter_id, not just their own.
alter table public.event_reports enable row level security;
alter table public.mission_reports enable row level security;

-- weekly_digest_runs (0015_weekly_digest.sql): an internal bookkeeping
-- table only ever read/written by the security-definer send_weekly_digest()
-- function, which bypasses RLS entirely for its own queries regardless.
-- It was never granted to anon/authenticated and has no policies of its
-- own -- enabling RLS with no policies makes it default-deny for every
-- normal (non-definer) caller, closing the gap without changing how the
-- digest function itself works.
alter table public.weekly_digest_runs enable row level security;
