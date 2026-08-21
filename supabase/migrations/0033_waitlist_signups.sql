-- Backs the public landing site (/web), not the mobile app or admin
-- dashboard. Collects pre-launch email signups. The landing site's Supabase
-- client always connects with the anon key (never service-role -- it has no
-- server secrets at all), so it can only ever do what these policies allow:
-- insert a row, never read, update, or delete one back.

create table waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table waitlist_signups enable row level security;

-- Table privileges are checked before RLS -- the policy below is reachable
-- only once anon can actually insert into the table at all.
grant insert on waitlist_signups to anon;

create policy "anyone can join the waitlist" on waitlist_signups
  for insert
  to anon
  with check (true);

-- No select/update/delete grants to anon/authenticated: only the
-- service-role key (e.g. from the admin dashboard, if a waitlist view is
-- added there later) can read the list back.
