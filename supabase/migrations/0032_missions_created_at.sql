-- missions had no creation timestamp at all (0001 only gave it `position`
-- for curated ordering). Needed for the admin dashboard's Overview counts
-- and to bring missions in line with every other content table.

alter table missions add column if not exists created_at timestamptz not null default now();
