-- The landing page contact form no longer collects a subject (the dashboard
-- has a single landing-page inbox, so a subject line added a required field
-- with no routing purpose) and no longer requires a name or email (visitors
-- can now submit anonymously; a name/email left behind just enables a reply
-- or a public shout-out if their idea ships).

alter table landing_contact_messages drop column subject;
alter table landing_contact_messages alter column name drop not null;
alter table landing_contact_messages alter column email drop not null;
