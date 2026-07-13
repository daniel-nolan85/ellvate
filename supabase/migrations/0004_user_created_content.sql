-- Allow authenticated users to create events and missions from the app.
-- Track the creator so RLS scopes inserts (and future edits/deletes) to owners.

alter table events add column if not exists created_by text
  references app_users(id) on delete set null;
alter table missions add column if not exists created_by text
  references app_users(id) on delete set null;

create policy "insert own event" on events for insert to authenticated
  with check (created_by = public.clerk_user_id());
create policy "delete own event" on events for delete to authenticated
  using (created_by = public.clerk_user_id());

create policy "insert own mission" on missions for insert to authenticated
  with check (created_by = public.clerk_user_id());
create policy "delete own mission" on missions for delete to authenticated
  using (created_by = public.clerk_user_id());
