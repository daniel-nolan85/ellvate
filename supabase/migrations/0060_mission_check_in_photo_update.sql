-- Lets a member attach, replace, or remove the photo on their own completed
-- mission check-in at any time after completing it -- 0025/0059 only ever
-- granted select/insert on mission_check_ins (append-only by design, since a
-- check-in itself records real progress that must never be edited). Only
-- photo_url is meant to change here; the app layer (updateMyCheckInPhoto)
-- is what actually restricts writes to that one column and to the caller's
-- own completing check-in row, same shape as the mission_comments precedent.
create policy "update own mission_check_in" on mission_check_ins for update to authenticated
  using (user_id = public.clerk_user_id())
  with check (user_id = public.clerk_user_id());
