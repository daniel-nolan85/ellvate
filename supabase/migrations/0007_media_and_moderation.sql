-- Media uploads (posts/events/missions galleries + user avatars) and the
-- moderation surfaces that ship alongside them: event comments, muting, and
-- reporting posts/comments/event-comments. Written to match the app code
-- added in this branch; not yet applied against a live project (dev runs
-- against the in-memory store).

alter table posts add column if not exists media jsonb;
alter table events add column if not exists media jsonb;
alter table missions add column if not exists media jsonb;
alter table app_users add column if not exists avatar_url text;

create table event_comments (
  id text primary key default gen_random_uuid()::text,
  event_id text not null references events(id) on delete cascade,
  author_id text not null references app_users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index event_comments_event_created_idx on event_comments (event_id, created_at asc);

create table user_mutes (
  muter_id text not null references app_users(id) on delete cascade,
  muted_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id)
);

create table post_reports (
  id text primary key default gen_random_uuid()::text,
  post_id text not null references posts(id) on delete cascade,
  reporter_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

create table comment_reports (
  id text primary key default gen_random_uuid()::text,
  comment_id text not null references comments(id) on delete cascade,
  reporter_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id)
);

create table event_comment_reports (
  id text primary key default gen_random_uuid()::text,
  event_comment_id text not null references event_comments(id) on delete cascade,
  reporter_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_comment_id, reporter_id)
);

alter table event_comments enable row level security;
alter table user_mutes enable row level security;
alter table post_reports enable row level security;
alter table comment_reports enable row level security;
alter table event_comment_reports enable row level security;

-- New tables created after 0003's blanket grant need their own grants — that
-- statement only covered tables that existed at the time it ran.
grant select on event_comments, user_mutes, post_reports, comment_reports, event_comment_reports
  to anon, authenticated;
grant insert, delete on event_comments, user_mutes to authenticated;
-- Reports are filed once and never removed by the app, so only insert is needed.
grant insert on post_reports, comment_reports, event_comment_reports to authenticated;

-- event_comments: public read, author-owned writes (mirrors "comments" in 0001/0003).
create policy "read event_comments" on event_comments for select to anon, authenticated using (true);
create policy "insert own event_comment" on event_comments for insert to authenticated
  with check (author_id = public.clerk_user_id());
create policy "delete own event_comment" on event_comments for delete to authenticated
  using (author_id = public.clerk_user_id());

-- user_mutes: only the muter can see/manage their own mute list.
create policy "read own mutes" on user_mutes for select to authenticated
  using (muter_id = public.clerk_user_id());
create policy "insert own mute" on user_mutes for insert to authenticated
  with check (muter_id = public.clerk_user_id());
create policy "delete own mute" on user_mutes for delete to authenticated
  using (muter_id = public.clerk_user_id());

-- *_reports: only the reporter can see/manage their own submitted reports;
-- there's no update (a report is filed once, not edited).
create policy "read own post reports" on post_reports for select to authenticated
  using (reporter_id = public.clerk_user_id());
create policy "insert own post report" on post_reports for insert to authenticated
  with check (reporter_id = public.clerk_user_id());

create policy "read own comment reports" on comment_reports for select to authenticated
  using (reporter_id = public.clerk_user_id());
create policy "insert own comment report" on comment_reports for insert to authenticated
  with check (reporter_id = public.clerk_user_id());

create policy "read own event comment reports" on event_comment_reports for select to authenticated
  using (reporter_id = public.clerk_user_id());
create policy "insert own event comment report" on event_comment_reports for insert to authenticated
  with check (reporter_id = public.clerk_user_id());

-- Storage: public-read bucket for post/event/mission media + avatars.
-- Object keys encode the owning entity's id (posts/{postId}/..., not the
-- acting user's id), which Storage RLS can't correlate back to ownership
-- without a lookup function; the app layer already verifies the caller owns
-- the post/event/mission/profile before calling uploadDataUrl/removeStorageObjects,
-- so Storage policy here only gates "must be an authenticated app user."
insert into storage.buckets (id, name, public)
values ('llv-community-media', 'llv-community-media', true)
on conflict (id) do nothing;

create policy "public read media" on storage.objects for select to anon, authenticated
  using (bucket_id = 'llv-community-media');
create policy "authenticated upload media" on storage.objects for insert to authenticated
  with check (bucket_id = 'llv-community-media');
create policy "authenticated delete media" on storage.objects for delete to authenticated
  using (bucket_id = 'llv-community-media');
