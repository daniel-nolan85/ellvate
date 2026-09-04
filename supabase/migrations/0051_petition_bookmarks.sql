-- Widen bookmarks (0013, last widened for services in 0020) to allow
-- bookmarking a petition. `create or replace function` fully replaces the
-- function body, so this carries forward every existing case rather than
-- only adding the new one.

alter table bookmarks drop constraint if exists bookmarks_target_type_check;
alter table bookmarks add constraint bookmarks_target_type_check
  check (target_type in ('post', 'event', 'mission', 'service', 'petition'));

create or replace function public.toggle_bookmark(p_target_type text, p_target_id text)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user_id text := public.clerk_user_id();
  v_deleted_id text;
  v_target_exists boolean;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_target_type not in ('post', 'event', 'mission', 'service', 'petition') then
    raise exception 'invalid_target';
  end if;

  delete from public.bookmarks
    where user_id = v_user_id
      and target_type = p_target_type
      and target_id = p_target_id
    returning id into v_deleted_id;

  if v_deleted_id is not null then
    return false;
  end if;

  v_target_exists := case p_target_type
    when 'post' then exists (select 1 from public.posts where id = p_target_id)
    when 'event' then exists (select 1 from public.events where id = p_target_id)
    when 'mission' then exists (select 1 from public.missions where id = p_target_id)
    when 'service' then exists (select 1 from public.service_listings where id = p_target_id)
    when 'petition' then exists (select 1 from public.petitions where id = p_target_id)
    else false
  end;
  if not v_target_exists then
    raise exception 'target_not_found';
  end if;

  begin
    insert into public.bookmarks (user_id, target_type, target_id)
    values (v_user_id, p_target_type, p_target_id);
  exception when unique_violation then
    return true;
  end;

  return true;
end;
$$;
