-- Mission comments: mirrors event_comments (0007) + notify_event_author (0008)
-- for missions, so people can discuss a mission the same way they can an
-- event or a forum post.

create table mission_comments (
  id text primary key default gen_random_uuid()::text,
  mission_id text not null references missions(id) on delete cascade,
  author_id text not null references app_users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index mission_comments_mission_created_idx on mission_comments (mission_id, created_at asc);

create table mission_comment_reports (
  id text primary key default gen_random_uuid()::text,
  mission_comment_id text not null references mission_comments(id) on delete cascade,
  reporter_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (mission_comment_id, reporter_id)
);

alter table mission_comments enable row level security;
alter table mission_comment_reports enable row level security;

grant select on mission_comments, mission_comment_reports to anon, authenticated;
grant insert, delete on mission_comments to authenticated;
grant insert on mission_comment_reports to authenticated;

-- mission_comments: public read, author-owned writes (mirrors event_comments in 0007).
create policy "read mission_comments" on mission_comments for select to anon, authenticated using (true);
create policy "insert own mission_comment" on mission_comments for insert to authenticated
  with check (author_id = public.clerk_user_id());
create policy "delete own mission_comment" on mission_comments for delete to authenticated
  using (author_id = public.clerk_user_id());

create policy "read own mission comment reports" on mission_comment_reports for select to authenticated
  using (reporter_id = public.clerk_user_id());
create policy "insert own mission comment report" on mission_comment_reports for insert to authenticated
  with check (reporter_id = public.clerk_user_id());

-- Notify a mission's creator when someone comments on it, mirroring
-- notify_event_author (0008). Uses kind 'mission' so it maps to the same
-- `notif_missions` preference the push-delivery trigger (0005) checks.
create or replace function public.notify_mission_author() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  author text;
  mission_title text;
  commenter_name text;
begin
  select m.created_by, m.title into author, mission_title
    from public.missions m where m.id = new.mission_id;
  if author is null or author = new.author_id then
    return new;
  end if;
  select u.name into commenter_name from public.app_users u where u.id = new.author_id;
  insert into public.notifications (user_id, kind, title, body, data)
  values (
    author,
    'mission',
    'New comment on your mission',
    coalesce(commenter_name, 'Someone') || ' commented on "' || mission_title || '"',
    jsonb_build_object('missionId', new.mission_id, 'commentId', new.id)
  );
  return new;
end;
$$;

create trigger mission_comments_notify_author
after insert on mission_comments
for each row execute function public.notify_mission_author();
