-- Every XP grant used to be two separate writes from the client: bump
-- app_users.xp, then separately insert into xp_ledger (grant.ts, check-in.ts,
-- profile.ts's onboarding bonus). If the second write ever failed after the
-- first committed -- a dropped connection, a Supabase timeout, a cancelled
-- request -- app_users.xp stayed permanently ahead of SUM(xp_ledger.amount),
-- which is exactly the "Profile shows 125 XP, Points History shows 100"
-- symptom reported against production. It also left a window for two
-- overlapping "complete onboarding" requests to both read onboarded_at as
-- null and both grant the welcome bonus.
--
-- grant_xp_and_log makes both writes atomic (one function, one transaction)
-- and, for one-shot grants, idempotent: the unique index below means a
-- second identical (user, reason, ref_id) grant just no-ops instead of
-- inserting a duplicate row, so a client retry after a failure -- or two
-- requests racing each other -- can never double-grant.
--
-- NULL ref_id values must collapse to a single dedupe key per (user,
-- reason) rather than each counting as distinct, which is what a plain
-- unique index over a nullable column would do (Postgres's NULL <> NULL).
create unique index xp_ledger_dedupe_idx
  on xp_ledger (user_id, reason, coalesce(ref_id, ''));

create or replace function public.grant_xp_and_log(
  p_amount integer,
  p_reason text,
  p_ref_id text default null
) returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user_id text := public.clerk_user_id();
  v_inserted boolean;
  v_new_xp integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.xp_ledger (user_id, amount, reason, ref_id)
  values (v_user_id, p_amount, p_reason, p_ref_id)
  on conflict (user_id, reason, coalesce(ref_id, '')) do nothing
  returning true into v_inserted;

  if v_inserted is null then
    return null;
  end if;

  update public.app_users set xp = xp + p_amount where id = v_user_id
  returning xp into v_new_xp;

  return v_new_xp;
end;
$$;

grant execute on function public.grant_xp_and_log(integer, text, text) to authenticated;

-- No automatic reconciliation here on purpose: xp_ledger only exists from
-- 0056 onward, so any account that earned XP before that migration shipped
-- legitimately has app_users.xp ahead of SUM(xp_ledger.amount) with no
-- ledger row to blame -- a blind "set xp = ledger sum" would wipe out real,
-- pre-ledger XP for every long-tenured member, not just repair genuinely
-- drifted accounts from the race this migration closes. See the read-only
-- audit query in the PR description for finding and hand-reviewing accounts
-- that actually drifted after 0056.
