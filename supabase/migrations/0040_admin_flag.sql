-- Marks an app_users row as a community admin so their content (posts,
-- comments, events, missions, service listings/reviews) can carry a visible
-- "official" mark in the app, distinct from dashboard_admins (which only
-- gates login to the separate /admin moderation tool and has no bearing on
-- content authorship). Toggled from the admin dashboard's Users section.
alter table app_users add column is_admin boolean not null default false;
