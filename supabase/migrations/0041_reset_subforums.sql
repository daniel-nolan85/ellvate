-- The original 0002_seed_data.sql seed mixed neighborhood names (MonteLago
-- Village, SouthShore, Del Webb Neighbors, The Island / North Shore) with
-- topic names, then 0016/0018 layered Golf/HOA/Sports Club on top without
-- ever removing the neighborhood ones or the resulting near-duplicates
-- (Golf & Country Club vs Golf, Trails & Fitness vs Trails, Dining &
-- Nightlife vs Dining). Every other place a category list matters --
-- interest-subforum-map.ts, category-accent.ts, the marketing site's forum
-- copy, and the Community Guidelines page -- was already written assuming
-- the clean topic-only list below, so the live table is the one that drifted.
--
-- posts.forum is a plain text column, not a foreign key to subforums.name
-- (see 0001_core_schema.sql), so this can't orphan any post -- and pre-launch
-- there are no real posts using the old names to begin with.
delete from subforums;

insert into subforums (name, position) values
  ('Announcements', 1),
  ('HOA', 2),
  ('Marina & Boating', 3),
  ('Golf', 4),
  ('Trails', 5),
  ('Dining', 6),
  ('Sports Club', 7),
  ('Buy & Sell', 8),
  ('General', 9);
