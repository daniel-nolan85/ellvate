-- Missions may be tied to a community day. Existing missions remain timeless;
-- newly composed missions can surface their selected calendar date in the app.

alter table missions add column if not exists scheduled_for date;

create index if not exists missions_scheduled_for_idx
  on missions (scheduled_for asc nulls last, position asc);
