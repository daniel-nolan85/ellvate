-- Member profiles show aggregate activity figures (posts/events/missions/
-- services counts) to everyone, but the detailed activity list — actual
-- post titles, event names, etc. — is opt-in. Defaults to false (private):
-- other members see only figures until this member turns sharing on.

alter table app_users add column if not exists activity_visible boolean not null default false;
