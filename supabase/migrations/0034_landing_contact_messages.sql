-- Backs the public landing site's Contact form (/web), a separate concern
-- from `contact_messages` (0030), which is signed-in mobile-app members
-- writing to moderators and requires a real app_users id + Clerk identity.
-- This one is anonymous site visitors -- no account, no RLS identity to
-- scope by -- so it follows the same anon-insert-only shape as
-- `waitlist_signups` (0033) instead.

create table landing_contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table landing_contact_messages enable row level security;

-- Table privileges are checked before RLS -- the policy below is reachable
-- only once anon can actually insert into the table at all.
grant insert on landing_contact_messages to anon;

create policy "anyone can send a contact message" on landing_contact_messages
  for insert
  to anon
  with check (true);

-- No select/update/delete grants to anon/authenticated: only the
-- service-role key (e.g. from the admin dashboard, if a view is added
-- there later) can read messages back. In the meantime, a configured
-- RESEND_API_KEY also forwards each message by email -- see
-- ../../web/lib/email/send-notification.ts.
