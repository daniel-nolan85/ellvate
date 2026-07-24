-- Pinning is a Twitter/Telegram-style personal pin, not a shared post
-- property: any signed-in member can pin any post, but at most one at a
-- time, and it's private to them — pinning a new post replaces their old
-- pin, and it never affects what any other user sees as pinned.
--
-- Storage moves from a `pinned` column on `posts` (global, one-per-post) to
-- a nullable `pinned_post_id` column on `app_users` (private, one-per-user).
alter table posts drop column if exists pinned;
alter table app_users add column if not exists pinned_post_id text references posts(id) on delete set null;

-- Toggling pin can't go through the regular "update own post" RLS policy
-- (0003), which is scoped to the post's author — pinning isn't ownership.
-- This SECURITY DEFINER function only ever touches the caller's own
-- app_users.pinned_post_id, resolving the caller from the JWT itself
-- (clerk_user_id()) rather than trusting a client-supplied id, so a request
-- can't toggle another user's pin. Scoping the elevated privilege to just
-- this one column/row is safer than a blanket UPDATE-any-app_users policy.
create or replace function public.toggle_post_pin(post_id text) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  caller text := public.clerk_user_id();
  current_pin text;
  now_pinned boolean;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  select pinned_post_id into current_pin from public.app_users where id = caller;

  if current_pin is not distinct from post_id then
    update public.app_users set pinned_post_id = null where id = caller;
    now_pinned := false;
  else
    update public.app_users set pinned_post_id = post_id where id = caller;
    now_pinned := true;
  end if;

  return now_pinned;
end;
$$;

grant execute on function public.toggle_post_pin(text) to authenticated;
