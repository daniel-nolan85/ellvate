-- Excludes the app's own admin account from the Leaderboard entirely, not
-- just its points. 0076 reset this account's xp to 0, but all-time rank is
-- sorted by missions_completed first (see leaderboard-supabase.ts's
-- getAllTimeLeaderboardSupabase), and that counter was untouched by 0076 --
-- an account that created/completed a lot of content while testing could
-- still rank #1 on missions_completed alone even at 0 xp.
--
-- on_leaderboard already existed (0001_core_schema.sql) but was only ever
-- read by the all-time query -- the windowed (week/month) query and both
-- memory-mode leaderboard paths never honored it at all (fixed in the same
-- app-code change as this migration). This is the one-time write setting
-- this specific account's flag; the column's default (true) is unchanged
-- for every real member.
update app_users set on_leaderboard = false where id = 'user_3K60ML5IuO9fY33URYTvFkhBWhG';

-- Backfills app_users.missions_completed for every user from mission_progress
-- (the authoritative completed-mission record) rather than trusting the
-- existing counter. Any mission completed then deleted BEFORE 0075 shipped
-- had its XP reversed (0074) but never decremented this counter, since that
-- decrement didn't exist yet -- those accounts are permanently stuck
-- overcounted without this one-time correction. mission_progress rows
-- cascade-delete along with their mission (see missions table's own FK), so
-- recomputing from it naturally excludes completions whose mission no
-- longer exists, matching exactly what 0075's trigger does for everything
-- deleted from here on.
update app_users
set missions_completed = coalesce((
  select count(*)
  from mission_progress mp
  where mp.user_id = app_users.id and mp.status = 'done'
), 0);
