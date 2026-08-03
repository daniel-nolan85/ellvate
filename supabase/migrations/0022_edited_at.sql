-- Shows a small "edited" indicator on content the author has updated at
-- least once. Null until the first edit, then stamped by the app on every
-- subsequent update+api route (posts, events, missions, service listings,
-- service reviews). Comments got the same column later, in 0023, once
-- comment editing shipped.

alter table posts add column if not exists edited_at timestamptz;
alter table events add column if not exists edited_at timestamptz;
alter table missions add column if not exists edited_at timestamptz;
alter table service_listings add column if not exists edited_at timestamptz;
alter table service_reviews add column if not exists edited_at timestamptz;
