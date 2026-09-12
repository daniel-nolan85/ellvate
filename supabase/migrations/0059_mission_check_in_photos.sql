-- Reintroduces check-in photos, this time as a genuinely optional, honor-
-- system add-on (see 0058's removal note) rather than a required,
-- face-detection-gated step: a user may attach a photo when checking in,
-- and every mission gets a gallery of everyone's optional uploads. Mirrors
-- 0025's original shape for the photo_url column and storage ownership
-- case, and the current (post-0053) shape for the report table -- built
-- fresh with reason/details/evidence_image_url baked in, not the older
-- shape 0025/0053 together produced before 0058 dropped it.

alter table mission_check_ins add column photo_url text;

create table mission_check_in_photo_reports (
  id text primary key default gen_random_uuid()::text,
  check_in_id text not null references mission_check_ins(id) on delete cascade,
  reporter_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  reason text check (
    reason is null or reason in (
      'spam', 'harassment', 'inappropriate_content', 'scam_or_fraud',
      'impersonation', 'other'
    )
  ),
  details text,
  evidence_image_url text,
  unique (check_in_id, reporter_id)
);

alter table mission_check_in_photo_reports enable row level security;

grant select, insert on mission_check_in_photo_reports to authenticated;

create policy "read own mission check-in photo reports" on mission_check_in_photo_reports for select to authenticated
  using (reporter_id = public.clerk_user_id());
create policy "insert own mission check-in photo report" on mission_check_in_photo_reports for insert to authenticated
  with check (reporter_id = public.clerk_user_id());

-- Check-in photo ownership belongs to whoever checked in, not the mission
-- author -- mirrors the 'avatars' case (self-owned, no table lookup) since
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
    when 'report-evidence' then entity_id = public.clerk_user_id()
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
