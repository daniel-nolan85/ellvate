-- Structural seed for the community shell: the real Lake Las Vegas forum
-- categories (neighborhoods and topics) plus the current events-week scaffold.
-- No demo users, posts, events, or missions — the app starts as an empty shell
-- and fills with real activity. A populated demo is loaded separately.

insert into subforums (name, position) values
  ('MonteLago Village', 1),
  ('SouthShore', 2),
  ('Del Webb Neighbors', 3),
  ('The Island / North Shore', 4),
  ('Marina & Boating', 5),
  ('Dining & Nightlife', 6),
  ('Golf & Country Club', 7),
  ('Trails & Fitness', 8),
  ('Buy & Sell', 9);

insert into week_days (date,day_label,date_label,is_today) values
  ('2026-07-14','MON','14',false),
  ('2026-07-15','TUE','15',false),
  ('2026-07-16','WED','16',false),
  ('2026-07-17','THU','17',false),
  ('2026-07-18','FRI','18',true),
  ('2026-07-19','SAT','19',false),
  ('2026-07-20','SUN','20',false);
