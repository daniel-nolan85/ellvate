-- Likes on mission check-in photos -- same shape as post_likes (0001/0003):
-- a composite-PK membership table plus a denormalized like_count column on
-- the parent row, kept in sync by a SECURITY DEFINER trigger rather than a
-- public-read policy or count query, so the count is always readable via
-- mission_check_ins' own existing (public-read) policy without granting any
-- broader read access to who liked what.

alter table mission_check_ins add column like_count integer not null default 0;

create table mission_check_in_photo_likes (
  check_in_id text not null references mission_check_ins(id) on delete cascade,
  user_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (check_in_id, user_id)
);

alter table mission_check_in_photo_likes enable row level security;

grant select, insert, delete on mission_check_in_photo_likes to authenticated;

create policy "read own check-in photo likes" on mission_check_in_photo_likes for select to authenticated
  using (user_id = public.clerk_user_id());
create policy "insert own check-in photo like" on mission_check_in_photo_likes for insert to authenticated
  with check (user_id = public.clerk_user_id());
create policy "delete own check-in photo like" on mission_check_in_photo_likes for delete to authenticated
  using (user_id = public.clerk_user_id());

create or replace function public.bump_check_in_photo_like_count() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    update public.mission_check_ins set like_count = like_count + 1 where id = new.check_in_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.mission_check_ins set like_count = greatest(0, like_count - 1) where id = old.check_in_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger mission_check_in_photo_likes_count
after insert or delete on mission_check_in_photo_likes
for each row execute function public.bump_check_in_photo_like_count();

-- Mirrors notify_post_liker (0010, gated on notif_replies by 0026) -- 'like'
-- shares the 'replies' notification bucket app-wide, there is no dedicated
-- likes preference (see src/backend/notifications/notifications.ts).
create or replace function public.notify_check_in_photo_liker() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_author text;
  v_mission_id text;
  v_liker_name text;
  v_wants boolean;
begin
  select c.user_id, c.mission_id into v_author, v_mission_id
    from public.mission_check_ins c where c.id = new.check_in_id;
  if v_author is null or v_author = new.user_id then
    return new;
  end if;
  select u.notif_replies into v_wants from public.app_users u where u.id = v_author;
  if v_wants is distinct from true then
    return new;
  end if;
  select u.name into v_liker_name from public.app_users u where u.id = new.user_id;
  insert into public.notifications (user_id, kind, title, body, data)
  values (
    v_author,
    'like',
    'New like on your check-in photo',
    coalesce(v_liker_name, 'Someone') || ' liked your check-in photo',
    jsonb_build_object('missionId', v_mission_id)
  );
  return new;
end;
$$;

create trigger mission_check_in_photo_likes_notify_author
after insert on mission_check_in_photo_likes
for each row execute function public.notify_check_in_photo_liker();
