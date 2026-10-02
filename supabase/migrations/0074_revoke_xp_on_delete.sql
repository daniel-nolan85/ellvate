-- Deleting content never revoked the XP its creation (or, for missions,
-- its completion) originally granted -- app_users.xp only ever went up.
-- This adds an AFTER DELETE trigger to every content table whose creation
-- grants CREATE_CONTENT_XP, so deleting the row atomically reverses the
-- matching xp_ledger entry too, regardless of which code path performed
-- the delete (this app's own backend, or the admin dashboard's generic
-- deleteContentAction, which deletes rows directly and never runs any of
-- this repo's TypeScript delete functions at all).
--
-- Also fixes a real, separate, pre-existing bug found while touching this:
-- 0056's xp_ledger_reason_check never included 'business_listing_created'
-- (business listings were added well after 0056 shipped, and nothing
-- updated this constraint), so every attempt to grant XP for creating a
-- business listing has been silently failing -- grant.ts's
-- business-listings/create.ts call catches the resulting error and
-- swallows it into NO_XP_AWARD on purpose, so this has never surfaced as a
-- visible error, just XP that silently never arrived.
alter table xp_ledger drop constraint if exists xp_ledger_reason_check;
alter table xp_ledger add constraint xp_ledger_reason_check check (reason in (
  'mission_completed',
  'mission_created',
  'post_created',
  'event_created',
  'service_created',
  'business_listing_created',
  'onboarding_bonus'
));

-- Reusable across every content table: the reason(s) to match come from the
-- trigger's own CREATE TRIGGER arguments (TG_ARGV), not a hardcoded value,
-- so one function backs every table below instead of one near-duplicate
-- function per content type. A given (reason, ref_id) pair can match more
-- than one ledger row -- e.g. several different members each completing
-- the same mission, each with their own 'mission_completed' row sharing
-- that mission's id as ref_id -- so this walks every match and credits
-- each affected user's own decrement, rather than assuming at most one.
create or replace function public.revoke_content_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    delete from public.xp_ledger
    where ref_id = old.id and reason = any(tg_argv)
    returning user_id, amount
  loop
    update public.app_users set xp = greatest(0, xp - r.amount) where id = r.user_id;
  end loop;
  return old;
end;
$$;

create trigger events_revoke_xp_on_delete
  after delete on events
  for each row execute function public.revoke_content_xp('event_created');

create trigger posts_revoke_xp_on_delete
  after delete on posts
  for each row execute function public.revoke_content_xp('post_created');

-- Both reasons: a mission's own creation grant, and every member's
-- completion grant, all keyed by the mission's own id as ref_id.
create trigger missions_revoke_xp_on_delete
  after delete on missions
  for each row execute function public.revoke_content_xp('mission_created', 'mission_completed');

create trigger service_listings_revoke_xp_on_delete
  after delete on service_listings
  for each row execute function public.revoke_content_xp('service_created');

create trigger business_listings_revoke_xp_on_delete
  after delete on business_listings
  for each row execute function public.revoke_content_xp('business_listing_created');
