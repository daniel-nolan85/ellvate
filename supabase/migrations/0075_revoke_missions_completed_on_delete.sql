-- revoke_content_xp() (0074) reverses the XP a deleted mission's completion
-- granted, but never touched app_users.missions_completed -- the counter
-- the Leaderboard screen reads directly (leaderboard-supabase.ts). My
-- Activity's own missions-completed count isn't stored at all (it's
-- `myMissionItems.filter(item => item.completed).length`, recomputed fresh
-- every render), which is why only the Leaderboard went stale: deleting a
-- completed mission removed it from that filtered list immediately, but
-- left the Leaderboard's separately-cached counter one too high forever.
--
-- Mirrors exactly how the counter is incremented in the first place
-- (missions-supabase.ts's check-in completion bumps missions_completed
-- right alongside the mission_completed xp_ledger row) -- this just runs
-- that same update in reverse, in the same loop that already reverses the
-- xp_ledger row, so it fires for every delete path (this app's own backend
-- or the admin dashboard's generic deleteContentAction) without needing a
-- second trigger.
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
    returning user_id, amount, reason
  loop
    update public.app_users set xp = greatest(0, xp - r.amount) where id = r.user_id;
    if r.reason = 'mission_completed' then
      update public.app_users
        set missions_completed = greatest(0, missions_completed - 1)
        where id = r.user_id;
    end if;
  end loop;
  return old;
end;
$$;
