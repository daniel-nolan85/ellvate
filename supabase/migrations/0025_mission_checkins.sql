-- Photo-proof check-ins + community reporting. mission_check_ins is a
-- proper history row per stop completion (mission_progress stays a bare
-- counter — it can't hold a photo/timestamp per stop, and there's no stable
-- row for a report to point at). Mirrors mission_comments (0017) for shape
-- and RLS: public read (a check-in's photo is meant to be visible to
-- neighbors for social accountability), insert-own, no update/delete
-- (append-only, matches every other check-in-related row in this app).

create table mission_check_ins (
  id text primary key default gen_random_uuid()::text,
  mission_id text not null references missions(id) on delete cascade,
  user_id text not null references app_users(id) on delete cascade,
  stop_index int not null,
  completed_at timestamptz not null default now(),
  photo_url text,
  unique (mission_id, user_id, stop_index)
);
create index mission_check_ins_mission_idx on mission_check_ins (mission_id, completed_at asc);

create table mission_check_in_reports (
  id text primary key default gen_random_uuid()::text,
  check_in_id text not null references mission_check_ins(id) on delete cascade,
  reporter_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (check_in_id, reporter_id)
);

alter table mission_check_ins enable row level security;
alter table mission_check_in_reports enable row level security;

grant select on mission_check_ins, mission_check_in_reports to anon, authenticated;
grant insert on mission_check_ins to authenticated;
grant insert on mission_check_in_reports to authenticated;

create policy "read mission_check_ins" on mission_check_ins for select to anon, authenticated using (true);
create policy "insert own mission_check_in" on mission_check_ins for insert to authenticated
  with check (user_id = public.clerk_user_id());

create policy "read own mission check-in reports" on mission_check_in_reports for select to authenticated
  using (reporter_id = public.clerk_user_id());
create policy "insert own mission check-in report" on mission_check_in_reports for insert to authenticated
  with check (reporter_id = public.clerk_user_id());

-- Check-in photo ownership belongs to whoever checked in, not the mission
-- author — mirrors the 'avatars' case (self-owned, no table lookup) since
-- the key path is mission-checkins/{userId}/{uuid}-{filename}.
create or replace function public.owns_media_object(object_name text) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  parts text[];
  folder text;
  entity_id text;
begin
  parts := string_to_array(object_name, '/');
  if array_length(parts, 1) < 2 then
    return false;
  end if;
  folder := parts[1];
  entity_id := parts[2];

  return case folder
    when 'avatars' then entity_id = public.clerk_user_id()
    when 'mission-checkins' then entity_id = public.clerk_user_id()
    when 'posts' then exists (
      select 1 from public.posts where id = entity_id and author_id = public.clerk_user_id()
    )
    when 'events' then exists (
      select 1 from public.events where id = entity_id and created_by = public.clerk_user_id()
    )
    when 'missions' then exists (
      select 1 from public.missions where id = entity_id and created_by = public.clerk_user_id()
    )
    else false
  end;
end;
$$;
