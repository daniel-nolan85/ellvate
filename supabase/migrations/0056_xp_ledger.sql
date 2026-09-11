-- One row per XP-earning event, so a member can see how they've accumulated
-- their total over time (Profile > tap the level bar). app_users.xp stays
-- the source of truth for the running total; this is purely an audit trail
-- alongside it, written by the same backend code that bumps xp.
create table xp_ledger (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references app_users(id) on delete cascade,
  amount integer not null,
  reason text not null check (reason in (
    'mission_completed',
    'mission_created',
    'post_created',
    'event_created',
    'service_created',
    'onboarding_bonus'
  )),
  ref_id text,
  created_at timestamptz not null default now()
);

create index xp_ledger_user_id_created_at_idx on xp_ledger (user_id, created_at desc, id desc);

alter table xp_ledger enable row level security;

grant select on xp_ledger to authenticated;
grant insert on xp_ledger to authenticated;

create policy "read own xp ledger" on xp_ledger for select to authenticated
  using (user_id = public.clerk_user_id());
create policy "insert own xp ledger entry" on xp_ledger for insert to authenticated
  with check (user_id = public.clerk_user_id());
