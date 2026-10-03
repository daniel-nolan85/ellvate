-- "I'm interested" -- a separate, lighter-weight signal from "I'm going"
-- (event_joins): tapping Join commits to attending and bumps the going
-- count/attendee roster; Interested is just "this caught my eye," with no
-- effect on going, attendees, XP, or any My Activity/leaderboard stat (by
-- request -- it's deliberately not scored). A member can set both
-- independently on the same event; neither clears the other.
--
-- Mirrors event_joins exactly in shape and RLS -- same composite PK (one
-- interest per user per event), same cascade-on-delete, same public-read/
-- own-write policy split.
create table event_interests (
  event_id text not null references events(id) on delete cascade,
  user_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table event_interests enable row level security;

-- event_joins' own grants were part of 0003's blanket grant (predates this
-- table), so this needs its own explicit grant the way every table added
-- after 0003 does.
grant select on event_interests to anon, authenticated;
grant insert, delete on event_interests to authenticated;

create policy "read event_interests" on event_interests for select to anon, authenticated using (true);
create policy "insert own interest" on event_interests for insert to authenticated
  with check (user_id = public.clerk_user_id());
create policy "delete own interest" on event_interests for delete to authenticated
  using (user_id = public.clerk_user_id());
