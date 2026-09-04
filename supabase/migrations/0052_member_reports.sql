-- Report-a-member: distinct from the existing per-content report tables
-- (post_reports, event_reports, ...) -- this lets a member be flagged to
-- moderators directly, even when no single piece of their content is the
-- problem. Mirrors post_reports (0007) for the table/RLS shape.

create table member_reports (
  id text primary key default gen_random_uuid()::text,
  reporter_id text not null references app_users(id) on delete cascade,
  reported_user_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (reporter_id, reported_user_id),
  check (reporter_id <> reported_user_id)
);

alter table member_reports enable row level security;

-- Reports are filed once and never removed by the app, so only insert is
-- needed alongside select (mirrors post_reports/petition_reports).
grant select on member_reports to authenticated;
grant insert on member_reports to authenticated;

create policy "read own member reports" on member_reports for select to authenticated
  using (reporter_id = public.clerk_user_id());
create policy "insert own member report" on member_reports for insert to authenticated
  with check (reporter_id = public.clerk_user_id());
