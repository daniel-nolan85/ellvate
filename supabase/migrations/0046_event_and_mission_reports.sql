-- Events and missions could only ever have their COMMENTS reported
-- (event_comment_reports/mission_comment_reports, 0007/0017) -- there was no
-- way to report an event or mission itself, unlike posts (post_reports,
-- 0007) and petitions (petition_reports, 0035). Both are freely
-- creatable by any member (not admin-only content), so this is a real
-- Apple 1.2 (UGC moderation) gap, not a hypothetical one. Mirrors
-- petition_reports exactly.

create table event_reports (
  id text primary key default gen_random_uuid()::text,
  event_id text not null references events(id) on delete cascade,
  reporter_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, reporter_id)
);

create table mission_reports (
  id text primary key default gen_random_uuid()::text,
  mission_id text not null references missions(id) on delete cascade,
  reporter_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (mission_id, reporter_id)
);

grant select, insert on event_reports, mission_reports to authenticated;

create policy "read own event report" on event_reports for select to authenticated
  using (reporter_id = public.clerk_user_id());
create policy "insert own event report" on event_reports for insert to authenticated
  with check (reporter_id = public.clerk_user_id());

create policy "read own mission report" on mission_reports for select to authenticated
  using (reporter_id = public.clerk_user_id());
create policy "insert own mission report" on mission_reports for insert to authenticated
  with check (reporter_id = public.clerk_user_id());
