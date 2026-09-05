-- Every report table so far only ever recorded who reported what, when --
-- no reason, no detail, no evidence, giving admin nothing to act on beyond
-- "someone reported this." Adds three optional columns to every one of the
-- 11 report tables: reason (a fixed set of short codes, validated both here
-- and in the app), details (free text), evidence_image_url (an optional
-- screenshot). Nullable, not backfilled: existing reports genuinely have no
-- reason on file, and the app can show that as "no reason given" rather than
-- fabricating one via a default value. New submissions are required to
-- supply a reason at the app layer; the check constraint here is
-- defense-in-depth against a client that skips that validation, not the
-- only enforcement of it.
--
-- Kept as 11 repeated alter statements rather than a shared reports table,
-- matching every one of these tables' own existing per-content-type design
-- (see 0007/0017/0020/0025/0035/0046/0052) -- consolidating them is a
-- bigger, separate migration than this feature needs.

do $$
declare
  report_table text;
begin
  foreach report_table in array array[
    'post_reports',
    'comment_reports',
    'event_comment_reports',
    'mission_comment_reports',
    'service_review_reports',
    'mission_check_in_reports',
    'petition_reports',
    'petition_comment_reports',
    'event_reports',
    'mission_reports',
    'member_reports'
  ]
  loop
    execute format('alter table %I add column reason text', report_table);
    execute format('alter table %I add column details text', report_table);
    execute format('alter table %I add column evidence_image_url text', report_table);
    execute format(
      $sql$alter table %I add constraint %I check (
        reason is null or reason in (
          'spam', 'harassment', 'inappropriate_content', 'scam_or_fraud',
          'impersonation', 'other'
        )
      )$sql$,
      report_table,
      report_table || '_reason_check'
    );
  end loop;
end $$;

-- Evidence screenshots upload to the same shared media bucket as every
-- other image in this app (see 0007_media_and_moderation.sql), under a new
-- 'report-evidence' folder keyed by the reporter's own id -- same shape as
-- 'avatars' below, since a report's evidence belongs to the person filing
-- it, not to any single piece of content (a report can be filed against a
-- user directly, with no content row to key off of).
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
