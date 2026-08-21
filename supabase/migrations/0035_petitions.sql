-- Petitions: a member raises a local issue, other members sign it, and once
-- signatures cross a threshold it's emailed to the HOA board. The threshold
-- is computed and frozen on the petitions row at creation time by the
-- application (max(ceil(20% of total app_users), 200)) -- never recalculated
-- as the user base grows, so a petition's goal doesn't move under it.
--
-- Signing must be atomic in a way none of the existing toggle patterns quite
-- cover: events' toggleJoin (check-then-write) accepts a race because its
-- "going" count self-corrects; bookmarks' toggle_bookmark is atomic but only
-- protects the toggle's own correctness. Here, crossing the threshold fires
-- a real side effect (an email to the HOA) that must happen exactly once, so
-- toggle_petition_signature below takes a `for update` lock on the single
-- petitions row before touching petition_signatures -- every concurrent
-- sign/unsign for that one petition serializes on it, guaranteeing exactly
-- one caller ever legally flips status from 'open' to 'succeeded'.

create table petitions (
  id text primary key default gen_random_uuid()::text,
  created_by text references app_users(id) on delete set null,
  title text not null,
  description text not null,
  category text not null check (category in
    ('safety', 'maintenance', 'amenities', 'landscaping', 'traffic-parking', 'noise-nuisance', 'other')),
  deadline_days integer not null check (deadline_days in (7, 14, 30, 60, 90)),
  deadline_at timestamptz not null,
  required_signatures integer not null,
  signature_count integer not null default 0,
  status text not null default 'open' check (status in ('open', 'succeeded', 'expired')),
  succeeded_at timestamptz,
  hoa_email_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index petitions_status_deadline_idx on petitions (status, deadline_at);
create index petitions_created_idx on petitions (created_at desc);

-- Composite-PK join, mirrors event_joins -- one signature per user per
-- petition, no separate id/unique-constraint needed.
create table petition_signatures (
  petition_id text not null references petitions(id) on delete cascade,
  user_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (petition_id, user_id)
);
create index petition_signatures_user_idx on petition_signatures (user_id);

-- Mirrors event_comments exactly, including edited_at (0023's convention).
-- Comments only make sense once a petition has actually succeeded (the
-- accountability record of what happened) -- enforced at the application
-- layer in createPetitionComment, not here, since it's a cross-row rule.
create table petition_comments (
  id text primary key default gen_random_uuid()::text,
  petition_id text not null references petitions(id) on delete cascade,
  author_id text not null references app_users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index petition_comments_petition_created_idx on petition_comments (petition_id, created_at asc);

-- Mirrors post_reports/event_comment_reports exactly. petition_comment_reports
-- follows the same "every comment-bearing content type gets its own report
-- table" convention already established for events/missions/service reviews.
create table petition_reports (
  id text primary key default gen_random_uuid()::text,
  petition_id text not null references petitions(id) on delete cascade,
  reporter_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (petition_id, reporter_id)
);
create table petition_comment_reports (
  id text primary key default gen_random_uuid()::text,
  petition_comment_id text not null references petition_comments(id) on delete cascade,
  reporter_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (petition_comment_id, reporter_id)
);

alter table petitions enable row level security;
alter table petition_signatures enable row level security;
alter table petition_comments enable row level security;
alter table petition_reports enable row level security;
alter table petition_comment_reports enable row level security;

-- petitions/petition_comments: public read (matches posts/events/missions),
-- client-side insert only -- there's no client update/delete grant on
-- petitions since every status transition goes through the SECURITY DEFINER
-- RPC below (which bypasses RLS internally), and there's no creator edit in
-- v1 (editing after signatures exist would retroactively change what people
-- signed).
grant select on petitions, petition_comments to anon, authenticated;
grant insert on petitions, petition_comments to authenticated;
grant select, insert on petition_reports, petition_comment_reports to authenticated;
-- No direct grants on petition_signatures -- all writes go through the RPC.

create policy "read petitions" on petitions for select to anon, authenticated using (true);
create policy "insert own petition" on petitions for insert to authenticated
  with check (created_by = public.clerk_user_id());

create policy "read own petition signature" on petition_signatures for select to authenticated
  using (user_id = public.clerk_user_id());

create policy "read petition_comments" on petition_comments for select to anon, authenticated using (true);
create policy "insert own petition_comment" on petition_comments for insert to authenticated
  with check (author_id = public.clerk_user_id());

create policy "read own petition report" on petition_reports for select to authenticated
  using (reporter_id = public.clerk_user_id());
create policy "insert own petition report" on petition_reports for insert to authenticated
  with check (reporter_id = public.clerk_user_id());

create policy "read own petition comment report" on petition_comment_reports for select to authenticated
  using (reporter_id = public.clerk_user_id());
create policy "insert own petition comment report" on petition_comment_reports for insert to authenticated
  with check (reporter_id = public.clerk_user_id());

-- SECURITY DEFINER: see the top-of-file comment for why this needs the
-- `for update` row lock rather than bookmarks' plain delete-then-insert --
-- the threshold-crossing side effect must fire exactly once.
create or replace function public.toggle_petition_signature(p_petition_id text)
returns table(signed boolean, signature_count integer, status text, just_succeeded boolean)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user_id text := public.clerk_user_id();
  v_deleted_id text;
  v_status text;
  v_required integer;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select p.status, p.required_signatures, p.signature_count
    into v_status, v_required, v_count
    from public.petitions p where p.id = p_petition_id for update;
  if v_status is null then
    raise exception 'petition_not_found';
  end if;

  delete from public.petition_signatures
    where petition_id = p_petition_id and user_id = v_user_id
    returning petition_id into v_deleted_id;

  if v_deleted_id is not null then
    v_count := greatest(0, v_count - 1);
    update public.petitions set signature_count = v_count where id = p_petition_id;
    return query select false, v_count, v_status, false;
    return;
  end if;

  if v_status <> 'open' then
    raise exception 'petition_not_open';
  end if;

  insert into public.petition_signatures (petition_id, user_id) values (p_petition_id, v_user_id);
  v_count := v_count + 1;

  if v_count >= v_required then
    v_status := 'succeeded';
    update public.petitions set signature_count = v_count, status = 'succeeded', succeeded_at = now()
      where id = p_petition_id;
    return query select true, v_count, v_status, true;
  else
    update public.petitions set signature_count = v_count where id = p_petition_id;
    return query select true, v_count, v_status, false;
  end if;
end;
$$;
grant execute on function public.toggle_petition_signature(text) to authenticated;

-- Notify every signer when their petition succeeds, mirroring the
-- notify_*_author trigger shape from 0026 (gated on a notif_* preference).
alter table app_users add column if not exists notif_petitions boolean not null default true;

create or replace function public.notify_petition_signers() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.status = 'open' and new.status = 'succeeded' then
    insert into public.notifications (user_id, kind, title, body, data)
    select s.user_id, 'petition', 'Petition succeeded',
      '"' || new.title || '" reached its signature goal.',
      jsonb_build_object('petitionId', new.id)
    from public.petition_signatures s
    join public.app_users u on u.id = s.user_id
    where u.notif_petitions = true;
  end if;
  return new;
end;
$$;

create trigger petitions_notify_signers
after update on petitions
for each row execute function public.notify_petition_signers();

-- Hourly expiry sweep, mirroring 0011's cron pattern. No dedupe column
-- needed -- `where status = 'open'` is itself idempotent across runs.
create or replace function public.expire_petitions() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.petitions set status = 'expired'
    where status = 'open' and deadline_at <= now();
end;
$$;

select cron.schedule(
  'expire-petitions',
  '0 * * * *',
  $$ select public.expire_petitions(); $$
);
