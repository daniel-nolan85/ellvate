-- Bookmarks: users can save posts, events, or missions for later. Object
-- references are polymorphic (target_type + target_id) rather than three
-- separate FKs, since a bookmark can point at any one of three unrelated
-- tables; existence of the target is validated at the application layer
-- (see src/backend/bookmarks), and a bookmark whose target has since been
-- deleted is simply skipped when hydrating the list rather than orphaned
-- with a dangling FK.

create table bookmarks (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references app_users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'event', 'mission')),
  target_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);
create index bookmarks_user_created_idx on bookmarks (user_id, created_at desc);

alter table bookmarks enable row level security;

grant select, insert, delete on bookmarks to authenticated;

-- Owner-only: a bookmark is private to the person who made it.
create policy "read own bookmarks" on bookmarks for select to authenticated
  using (user_id = public.clerk_user_id());
create policy "insert own bookmark" on bookmarks for insert to authenticated
  with check (user_id = public.clerk_user_id());
create policy "delete own bookmark" on bookmarks for delete to authenticated
  using (user_id = public.clerk_user_id());
