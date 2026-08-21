-- Contact-us feature: a signed-in member can send the moderators a message
-- with a fixed category plus free text. One-way submission -- no reply
-- thread, no read-back UI on the mobile side. Reviewed exclusively via the
-- admin dashboard's service-role client, same as every other moderated table.

create table contact_messages (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references app_users(id) on delete cascade,
  category text not null check (category in ('bug', 'feedback', 'question', 'other')),
  message text not null,
  created_at timestamptz not null default now()
);
create index contact_messages_created_idx on contact_messages (created_at desc);

alter table contact_messages enable row level security;

-- Mirrors post_reports (0007) / service_review_reports (0020): insert-own,
-- read-own. Scoped to `authenticated` only (not `anon`) since this is
-- private user-submitted content, not public-readable content.
grant select, insert on contact_messages to authenticated;

create policy "read own contact messages" on contact_messages for select to authenticated
  using (user_id = public.clerk_user_id());
create policy "insert own contact message" on contact_messages for insert to authenticated
  with check (user_id = public.clerk_user_id());
