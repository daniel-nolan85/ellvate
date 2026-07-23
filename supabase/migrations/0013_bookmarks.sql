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

-- SECURITY DEFINER: toggles a bookmark as one atomic statement instead of the
-- app doing a separate check-then-insert-or-delete round trip. That
-- read-then-write pattern let two rapid taps both observe "not bookmarked"
-- and both attempt an insert, so the unique constraint rejected the loser
-- with a hard error instead of a deterministic toggle; it also left a window
-- where the target could be deleted between the check and the write. Here,
-- the delete-then-insert runs in one statement per call, and a losing insert
-- (unique_violation, meaning a concurrent call already added the same row) is
-- treated as success — the desired "bookmarked" end state was already
-- reached, by us or by the other request, so there's nothing to surface as
-- an error.
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
  if p_target_type not in ('post', 'event', 'mission') then
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

grant execute on function public.toggle_bookmark(text, text) to authenticated;
