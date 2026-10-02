-- The app's own creator/admin account (daniel@nolancode.com, Clerk id
-- below) was earning XP for the same actions as everyone else, which put
-- it at the top of the Leaderboard by a wide margin -- not a fun or
-- meaningful comparison for the actual neighbors the leaderboard is for.
-- Every XP-earning action in the app (content creation via grant.ts,
-- mission completion, the onboarding bonus) already funnels through this
-- one RPC, so excluding one account here, rather than in each call site,
-- covers all of them -- current and future -- for free. Mirrors the
-- existing dedupe no-op (returns null, grants nothing): every caller
-- already treats a null result as "no XP was awarded" without error.
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

  if v_user_id = 'user_3K60ML5IuO9fY33URYTvFkhBWhG' then
    return null;
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

-- One-time correction to match the new rule above: this account had
-- already accumulated 490 XP (and the matching Points History entries)
-- under the old, unrestricted behavior. Both the running total and its
-- ledger history are cleared together so Points History doesn't keep
-- showing entries that no longer add up to the account's (now zero) XP.
delete from public.xp_ledger where user_id = 'user_3K60ML5IuO9fY33URYTvFkhBWhG';
update public.app_users set xp = 0 where id = 'user_3K60ML5IuO9fY33URYTvFkhBWhG';
