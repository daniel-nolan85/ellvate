-- Adds two forum categories that were missing from the original seed:
-- HOA (an official-channel category, alongside Announcements) and Golf (a
-- nature/outdoors category, alongside Trails). Positioned at the end of the
-- existing list rather than renumbering everything.
insert into subforums (name, position) values
  ('HOA', 10),
  ('Golf', 11)
on conflict (name) do nothing;
