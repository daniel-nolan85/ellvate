-- Adds an optional end time and an optional cost to events. Mirrors the
-- existing starts_at/time_label pair for symmetry (ends_at is the real
-- timestamp, end_time_label is the precomputed display string, same
-- no-timezone-conversion convention as starts_at/time_label). cost is
-- nullable free text rather than a numeric/cents column -- the house
-- convention for money-adjacent, user-authored info (see
-- business_listings.current_specials, service_listings.hours) is free
-- text, and no currency-formatting code exists anywhere in this app to
-- justify a structured numeric column. Lets organizers write "Free",
-- "$15", or "$10 cash at door".
alter table events add column if not exists ends_at timestamptz;
alter table events add column if not exists end_time_label text;
alter table events add column if not exists cost text;
