-- Missions previously stored a raw icon name in `icon` (Sun/ArrowUp/Star/Moon
-- — 4 arbitrary options with no connection to what the mission actually is).
-- Renamed to `theme`, now storing a semantic category (mirrors
-- services.category) that the app derives an icon + color from, via
-- src/modules/missions/mission-theme.ts.
alter table missions rename column icon to theme;
update missions set theme = case theme
  when 'Sun' then 'day'
  when 'Moon' then 'night'
  when 'Star' then 'social'
  when 'ArrowUp' then 'trail'
  else 'trail'
end;

-- `stops_total` used to be a bare number picked in the composer, disconnected
-- from what the mission actually asked you to do. `stops` now holds the
-- ordered text for each stop (what stops_total counts); stops_total itself
-- stays as a column (still read far more often than stops) but is always
-- kept equal to jsonb_array_length(stops) by the app from here on.
alter table missions add column if not exists stops jsonb not null default '[]'::jsonb;
update missions set stops = (
  select coalesce(jsonb_agg('Stop ' || n), '[]'::jsonb)
  from generate_series(1, stops_total) n
) where stops = '[]'::jsonb and stops_total > 0;

-- Locked missions were dead scaffolding: nothing ever set locked_by_default
-- to true or unlocked a mission — no prerequisite chain, no admin toggle.
alter table missions drop column if exists locked_by_default;
update mission_progress set status = 'active' where status = 'locked';
alter table mission_progress drop constraint if exists mission_progress_status_check;
alter table mission_progress add constraint mission_progress_status_check
  check (status in ('active', 'done'));
