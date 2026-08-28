-- Three MUST-FIX gaps found in a pre-launch security/correctness review.

-- 1) app_users has never had a DELETE policy. 0003_rls_policies_and_triggers.sql
--    granted the `delete` privilege on the table but never created the
--    matching RLS policy -- and RLS denies every row by default until a
--    policy explicitly allows it. deleteAccountSupabase's own
--    `.from('app_users').delete().eq('id', userId)` therefore silently
--    matched zero rows in production: no error (delete-with-no-match isn't
--    an error), so the caller believed the account and everything that
--    cascades from it (posts, comments, service listings, etc. -- see the
--    ON DELETE CASCADE fks) was gone, when none of it was ever touched.
--    This is an App Store 5.1.1(v) blocker (in-app account deletion must
--    actually delete the account's data).
create policy "delete own app_user" on app_users for delete to authenticated
  using (id = public.clerk_user_id());

-- 2) petition_comments only ever got select/insert grants+policies
--    (0035_petitions.sql) -- unlike every other comment table in this app
--    (event_comments, mission_comments), it never got update/delete. Editing
--    or deleting your own petition comment 503s every time: the UPDATE/DELETE
--    call matches zero rows (no grant, no policy), so `.select(...).single()`
--    finds nothing and errors. Mirrors event_comments' "update/delete own"
--    policies (0007/0023).
grant update, delete on petition_comments to authenticated;
create policy "update own petition_comment" on petition_comments for update to authenticated
  using (author_id = public.clerk_user_id()) with check (author_id = public.clerk_user_id());
create policy "delete own petition_comment" on petition_comments for delete to authenticated
  using (author_id = public.clerk_user_id());

-- 3) app_users' "update own app_user" policy (0003) is column-blind: it lets
--    the row's owner update every column, including is_admin
--    (0040_admin_flag.sql), which the app itself never exposes for
--    self-editing -- only the moderation dashboard's service-role client
--    does. Nothing in the current app calls this path client-side, but the
--    RLS policy itself would allow any authenticated Supabase client (not
--    just this app's UI) to grant itself the admin badge. This trigger closes
--    that path without touching the broad grant the profile/mission-progress
--    update flows legitimately depend on (name, xp, streak_days, etc.):
--    is_admin can only change when the request isn't running as the row's
--    own owner under RLS -- i.e. the dashboard's service-role client.
create or replace function public.prevent_self_admin_promotion() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.is_admin is distinct from old.is_admin and auth.role() <> 'service_role' then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

create trigger app_users_guard_is_admin
before update on app_users
for each row execute function public.prevent_self_admin_promotion();
