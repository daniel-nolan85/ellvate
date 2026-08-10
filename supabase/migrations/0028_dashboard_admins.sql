-- Backs the separate admin dashboard app (/admin), not the mobile app. Lists
-- who may sign in to the moderation tool -- distinct from app_users, which is
-- the community membership being moderated, not the moderators. The
-- dashboard's own Supabase client always connects with the service-role key
-- (server-only, bypasses RLS by design, since it needs to read/act across
-- every member's content) so these policies are defense-in-depth: nothing
-- reachable through the public anon/authenticated API should ever see or
-- touch this table.

create table dashboard_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  added_by text references dashboard_admins(email),
  created_at timestamptz not null default now()
);

alter table dashboard_admins enable row level security;
-- No grants to anon/authenticated at all: only the service-role key (which
-- bypasses RLS and grants entirely) can read or write this table.
