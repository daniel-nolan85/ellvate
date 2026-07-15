-- Optional demo data for showcasing the app, using real Lake Las Vegas places.
-- The app ships as an empty shell; run this only when you want a populated demo.
--
-- Re-runnable: it clears its own prefixed demo rows before reinserting and never
-- touches real users or their content. Day labels mirror the week_days strip so
-- events group correctly under it.
--
-- Run with:  supabase db execute --file supabase/seed/demo-seed.sql
--   (or paste into the SQL editor / MCP execute_sql).

begin;

-- Remove any previous demo rows (safe to re-run).
delete from event_joins where event_id like 'devt-%';
delete from mission_progress where mission_id like 'dmsn-%';
delete from post_likes where post_id like 'dpost-%';
delete from comments where post_id like 'dpost-%';
delete from posts where id like 'dpost-%';
delete from events where id like 'devt-%';
delete from missions where id like 'dmsn-%';
delete from app_users where id like 'demo-%';

-- Demo neighbours (real-sounding residents; never an HOA account).
insert into app_users (id,name,xp,streak_days,missions_completed,previous_rank,on_leaderboard) values
  ('demo-mia','Mia Alvarez',3820,6,41,1,true),
  ('demo-carlos','Carlos Nguyen',3110,4,35,2,true),
  ('demo-priya','Priya Rao',2640,3,29,3,true),
  ('demo-sam','Sam Whitfield',2190,0,24,4,true);

-- Events at real venues, aligned to the current week strip (14 MON … 20 SUN).
insert into events (id,starts_at,time_label,day_label,date_label,title,place,tag,featured,going_base,seed_attendee_ids) values
  ('devt-1','2026-07-19T19:00:00Z','7:00 PM','SAT','19','Saturday Lakeside Music','MonteLago Village','Music',true,64,'{demo-mia,demo-carlos,demo-priya}'),
  ('devt-2','2026-07-19T10:00:00Z','10:00 AM','SAT','19','Village Artisan Market','The Village at Lake Las Vegas','Market',false,140,'{demo-mia}'),
  ('devt-3','2026-07-20T08:00:00Z','8:00 AM','SUN','20','Sunrise Beach Yoga','The Westin Lake Las Vegas','Fitness',false,22,'{demo-priya,demo-sam}'),
  ('devt-4','2026-07-18T17:30:00Z','5:30 PM','FRI','18','Community Paddle Meetup','Lake Las Vegas Water Sports','Fitness',false,31,'{demo-carlos,demo-sam}'),
  ('devt-5','2026-07-17T18:30:00Z','6:30 PM','THU','17','Sunset Cruise Social','La Contessa Yacht','Social',false,18,'{demo-mia,demo-priya}'),
  ('devt-6','2026-07-20T14:00:00Z','2:00 PM','SUN','20','Family Aqua Park Day','Lake Las Vegas Aqua Park','Family',false,52,'{demo-sam}');

-- Missions tied to real Lake Las Vegas points of interest.
insert into missions (id,title,description,scheduled_for,xp,stops_total,icon,position,locked_by_default) values
  ('dmsn-1','Paddle the Lake','Rent a kayak or paddleboard from Lake Las Vegas Water Sports and get on the water.','2026-07-14',75,1,'Sun',0,false),
  ('dmsn-2','Village Restaurant Crawl','Dine at three MonteLago Village restaurants — Luna Rossa, Sonrisa Grill and Marssa.','2026-07-15',120,3,'Star',1,false),
  ('dmsn-3','Ride the Loop','Walk, run or bike a stretch of the River Mountains Loop Trail from the lake.','2026-07-16',100,1,'ArrowUp',2,false),
  ('dmsn-4','Play Reflection Bay','Complete a round at the Jack Nicklaus Signature Reflection Bay Golf Club.','2026-07-17',150,1,'Star',3,false),
  ('dmsn-5','Sunset at the Marina','Catch a sunset over the water from the MonteLago Village marina.','2026-07-18',25,1,'Moon',4,false),
  ('dmsn-6','Catch Lakeside Music','Attend a Saturday-night live music set on the MonteLago Village waterfront.','2026-07-19',40,1,'Moon',5,false);

-- A few forum posts across the real neighbourhood/topic channels. reply_count
-- starts at 0 and the reply-count trigger sets it from the comments seeded below.
insert into posts (id,forum,author_id,title,excerpt,like_count,reply_count,pinned,created_at) values
  ('dpost-1','Marina & Boating','demo-carlos','Best morning to paddle before the wind?','New to the lake — when do you launch from the marina before it gets choppy?',34,0,false, now() - interval '3 hours'),
  ('dpost-2','Dining & Nightlife','demo-mia','Luna Rossa patio is open again','Lakeside seating is back at Luna Rossa in MonteLago Village. Go early on weekends.',52,0,false, now() - interval '8 hours'),
  ('dpost-3','Trails & Fitness','demo-priya','River Mountains Loop — shade tips?','Which segments have the most shade for a midday ride in July?',18,0,false, now() - interval '26 hours'),
  ('dpost-4','MonteLago Village','demo-sam','Saturday music lineup?','Anyone know who is playing on the waterfront this Saturday night?',27,0,false, now() - interval '30 hours');

-- A handful of replies so posts open to real conversation, not empty threads.
insert into comments (id,post_id,author_id,body,created_at) values
  ('dcmt-1','dpost-1','demo-mia','Early — I''m usually on the water by 7 before it picks up.', now() - interval '2 hours'),
  ('dcmt-2','dpost-1','demo-sam','Launch from the MonteLago marina, it stays calmest there.', now() - interval '90 minutes'),
  ('dcmt-3','dpost-2','demo-priya','Finally! The lakeside tables are the best seats in the village.', now() - interval '7 hours'),
  ('dcmt-4','dpost-2','demo-carlos','Went Saturday — get there before 6 or you''ll wait.', now() - interval '6 hours'),
  ('dcmt-5','dpost-3','demo-sam','The stretch near the dam has the most shade midday.', now() - interval '24 hours'),
  ('dcmt-6','dpost-4','demo-mia','Local band this week — starts around 7 on the waterfront.', now() - interval '28 hours');

commit;
