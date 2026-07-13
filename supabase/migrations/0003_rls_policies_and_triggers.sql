-- Least-privilege access for Clerk third-party auth.
-- Authenticated Clerk users -> role `authenticated`, identified by auth.jwt()->>'sub'.
-- Unauthenticated -> role `anon` (public reads only). No service-role/secret key.
-- Cross-user writes (counts, notifications) go through SECURITY DEFINER triggers.

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on
  posts, comments, post_likes, event_joins, mission_progress, app_users,
  push_tokens, notifications
  to authenticated;

create or replace function public.clerk_user_id() returns text
language sql stable set search_path = ''
as $$ select nullif(auth.jwt()->>'sub', '') $$;

-- Public reads
create policy "read subforums" on subforums for select to anon, authenticated using (true);
create policy "read week_days" on week_days for select to anon, authenticated using (true);
create policy "read missions" on missions for select to anon, authenticated using (true);
create policy "read app_users" on app_users for select to anon, authenticated using (true);
create policy "read posts" on posts for select to anon, authenticated using (true);
create policy "read comments" on comments for select to anon, authenticated using (true);
create policy "read events" on events for select to anon, authenticated using (true);
create policy "read event_joins" on event_joins for select to anon, authenticated using (true);

-- app_users: manage only your own row
create policy "insert own app_user" on app_users for insert to authenticated
  with check (id = public.clerk_user_id());
create policy "update own app_user" on app_users for update to authenticated
  using (id = public.clerk_user_id()) with check (id = public.clerk_user_id());

-- posts: author-owned writes
create policy "insert own post" on posts for insert to authenticated
  with check (author_id = public.clerk_user_id());
create policy "update own post" on posts for update to authenticated
  using (author_id = public.clerk_user_id()) with check (author_id = public.clerk_user_id());
create policy "delete own post" on posts for delete to authenticated
  using (author_id = public.clerk_user_id());

-- comments: author-owned writes
create policy "insert own comment" on comments for insert to authenticated
  with check (author_id = public.clerk_user_id());
create policy "delete own comment" on comments for delete to authenticated
  using (author_id = public.clerk_user_id());

-- post_likes / event_joins / mission_progress / push_tokens: user owns their rows
create policy "read own likes" on post_likes for select to authenticated
  using (user_id = public.clerk_user_id());
create policy "insert own like" on post_likes for insert to authenticated
  with check (user_id = public.clerk_user_id());
create policy "delete own like" on post_likes for delete to authenticated
  using (user_id = public.clerk_user_id());

create policy "insert own join" on event_joins for insert to authenticated
  with check (user_id = public.clerk_user_id());
create policy "delete own join" on event_joins for delete to authenticated
  using (user_id = public.clerk_user_id());

create policy "read own progress" on mission_progress for select to authenticated
  using (user_id = public.clerk_user_id());
create policy "insert own progress" on mission_progress for insert to authenticated
  with check (user_id = public.clerk_user_id());
create policy "update own progress" on mission_progress for update to authenticated
  using (user_id = public.clerk_user_id()) with check (user_id = public.clerk_user_id());

create policy "read own push tokens" on push_tokens for select to authenticated
  using (user_id = public.clerk_user_id());
create policy "insert own push token" on push_tokens for insert to authenticated
  with check (user_id = public.clerk_user_id());
create policy "update own push token" on push_tokens for update to authenticated
  using (user_id = public.clerk_user_id()) with check (user_id = public.clerk_user_id());
create policy "delete own push token" on push_tokens for delete to authenticated
  using (user_id = public.clerk_user_id());

-- notifications: read/mark your own; inserts happen only via the trigger below
create policy "read own notifications" on notifications for select to authenticated
  using (user_id = public.clerk_user_id());
create policy "update own notifications" on notifications for update to authenticated
  using (user_id = public.clerk_user_id()) with check (user_id = public.clerk_user_id());

-- Cross-user maintenance (bypass RLS in a controlled way)
create or replace function public.bump_reply_count() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set reply_count = reply_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set reply_count = greatest(0, reply_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.bump_like_count() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger post_likes_like_count
after insert or delete on post_likes
for each row execute function public.bump_like_count();

create or replace function public.notify_post_author() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  author text;
  post_title text;
  commenter_name text;
begin
  select p.author_id, p.title into author, post_title
    from public.posts p where p.id = new.post_id;
  if author is null or author = new.author_id then
    return new;
  end if;
  select u.name into commenter_name from public.app_users u where u.id = new.author_id;
  insert into public.notifications (user_id, kind, title, body, data)
  values (
    author,
    'comment',
    'New reply to your post',
    coalesce(commenter_name, 'Someone') || ' commented on "' || post_title || '"',
    jsonb_build_object('postId', new.post_id, 'commentId', new.id)
  );
  return new;
end;
$$;

create trigger comments_notify_author
after insert on comments
for each row execute function public.notify_post_author();
