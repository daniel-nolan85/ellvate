-- LLV Community App — core schema.
-- Applied to the Supabase project via MCP; kept here for version control.
-- Access is via the API routes using the publishable key + a forwarded Clerk
-- token; RLS (see 0003) is the security boundary. No service-role key is used.

create table app_users (
  id text primary key,
  name text not null,
  xp integer not null default 0,
  streak_days integer not null default 0,
  missions_completed integer not null default 0,
  previous_rank integer,
  title text not null default 'LAKE EXPLORER',
  role text check (role in ('resident','new','business','visitor')),
  interests text[] not null default '{}',
  ai_comfort text check (ai_comfort in ('new','casual','power')),
  notif_events boolean not null default true,
  notif_replies boolean not null default true,
  notif_missions boolean not null default true,
  notif_digest boolean not null default false,
  onboarded_at timestamptz,
  on_leaderboard boolean not null default true,
  created_at timestamptz not null default now()
);

create table subforums (
  name text primary key,
  position integer not null
);

create table posts (
  id text primary key default gen_random_uuid()::text,
  forum text not null,
  author_id text not null references app_users(id) on delete cascade,
  title text not null,
  excerpt text not null default '',
  like_count integer not null default 0,
  reply_count integer not null default 0,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index posts_forum_created_idx on posts (forum, created_at desc);
create index posts_created_idx on posts (created_at desc);

create table post_likes (
  post_id text not null references posts(id) on delete cascade,
  user_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table comments (
  id text primary key default gen_random_uuid()::text,
  post_id text not null references posts(id) on delete cascade,
  author_id text not null references app_users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index comments_post_created_idx on comments (post_id, created_at asc);

create table events (
  id text primary key default gen_random_uuid()::text,
  starts_at timestamptz not null,
  time_label text not null,
  day_label text not null,
  date_label text not null,
  title text not null,
  place text not null,
  tag text not null,
  featured boolean not null default false,
  going_base integer not null default 0,
  seed_attendee_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index events_starts_idx on events (featured desc, starts_at asc);

create table event_joins (
  event_id text not null references events(id) on delete cascade,
  user_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table missions (
  id text primary key,
  title text not null,
  description text not null,
  xp integer not null,
  stops_total integer not null,
  icon text not null,
  position integer not null,
  locked_by_default boolean not null default false
);

create table mission_progress (
  mission_id text not null references missions(id) on delete cascade,
  user_id text not null references app_users(id) on delete cascade,
  stops_done integer not null default 0,
  status text not null default 'active' check (status in ('active','done','locked')),
  updated_at timestamptz not null default now(),
  primary key (mission_id, user_id)
);

create table week_days (
  date date primary key,
  day_label text not null,
  date_label text not null,
  is_today boolean not null default false
);

create table push_tokens (
  token text primary key,
  user_id text not null references app_users(id) on delete cascade,
  platform text not null check (platform in ('ios','android','web')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on push_tokens (user_id);

create table notifications (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references app_users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on notifications (user_id, created_at desc);

-- reply_count is redefined as SECURITY DEFINER in 0003 (so any commenter can bump
-- the post author's row under RLS).
create or replace function public.bump_reply_count() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set reply_count = reply_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set reply_count = greatest(0, reply_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger comments_reply_count
after insert or delete on comments
for each row execute function public.bump_reply_count();

alter table app_users enable row level security;
alter table subforums enable row level security;
alter table posts enable row level security;
alter table post_likes enable row level security;
alter table comments enable row level security;
alter table events enable row level security;
alter table event_joins enable row level security;
alter table missions enable row level security;
alter table mission_progress enable row level security;
alter table week_days enable row level security;
alter table push_tokens enable row level security;
alter table notifications enable row level security;
