-- 0003's blanket grant only covered posts, comments, post_likes, event_joins,
-- mission_progress, app_users, push_tokens, and notifications — events and
-- missions were never granted insert/update/delete table privileges at all,
-- so 0004's insert/delete RLS policies for those tables have never actually
-- been reachable in real Supabase (table privileges are checked before RLS).
-- The update path added for event/mission editing (media attach, title,
-- schedule, etc.) has no owner UPDATE policy either. This grants the missing
-- privileges and adds owner-scoped UPDATE policies for both tables.

grant insert, update, delete on events, missions to authenticated;

create policy "update own event" on events for update to authenticated
  using (created_by = public.clerk_user_id()) with check (created_by = public.clerk_user_id());

create policy "update own mission" on missions for update to authenticated
  using (created_by = public.clerk_user_id()) with check (created_by = public.clerk_user_id());
