alter table comments add column if not exists edited_at timestamptz;
alter table event_comments add column if not exists edited_at timestamptz;
alter table mission_comments add column if not exists edited_at timestamptz;

-- Comment editing is a new capability — these tables previously only granted
-- insert/delete to authenticated users, with no update path at all.
grant update on comments to authenticated;
grant update on event_comments to authenticated;
grant update on mission_comments to authenticated;

create policy "update own comment" on comments for update to authenticated
  using (author_id = public.clerk_user_id())
  with check (author_id = public.clerk_user_id());
create policy "update own event_comment" on event_comments for update to authenticated
  using (author_id = public.clerk_user_id())
  with check (author_id = public.clerk_user_id());
create policy "update own mission_comment" on mission_comments for update to authenticated
  using (author_id = public.clerk_user_id())
  with check (author_id = public.clerk_user_id());
