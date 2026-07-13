-- Seed data mirroring the app's original in-memory fixtures.

insert into subforums (name, position) values
  ('All',0),('Announcements',1),('Marina & Boating',2),('Dining',3),
  ('Trails',4),('Buy & Sell',5),('Events',6);

insert into app_users (id,name,xp,streak_days,missions_completed,previous_rank,on_leaderboard) values
  ('user-mia','Mia Lake',3820,0,41,1,true),
  ('user-andre','Andre King',3540,0,38,3,true),
  ('user-jordan','Jordan Diaz',3110,0,35,2,true),
  ('user-priya','Priya Rao',2640,0,29,6,true),
  ('user-sam','Sam Ortiz',2190,0,24,5,true),
  ('demo-user','You',1980,12,21,7,true),
  ('user-hoa','HOA Board',0,0,0,null,false),
  ('user-riley','Riley Kim',0,0,0,null,false);

insert into posts (id,forum,author_id,title,excerpt,like_count,reply_count,pinned,created_at) values
  ('post-1','Marina & Boating','user-jordan','Best spots to kayak at sunrise?','New to the lake — where do you all put in before the wind picks up? Looking for calm water near the village.',61,24,false, now() - interval '2 hours'),
  ('post-2','Announcements','user-hoa','Fountain show returns Friday nights','Starting this week the Village fountains run 7–10pm. Bring the family down to the promenade.',138,12,true, now() - interval '5 hours'),
  ('post-3','Dining','user-mia','New patio at the waterfront bistro','They finally opened lakeside seating. Go early — it filled up fast on Saturday.',92,33,false, now() - interval '24 hours'),
  ('post-4','Trails','user-andre','Loop trail partially closed for repaving','North segment is down until next Tuesday. Detour is signed near the boat club.',27,8,false, now() - interval '25 hours');

insert into events (id,starts_at,time_label,day_label,date_label,title,place,tag,featured,going_base,seed_attendee_ids) values
  ('event-1','2026-07-18T18:30:00Z','6:30 PM','FRI','18','Locals Networking Mixer','MonteLago Village','Networking',true,48,'{user-riley,user-mia,user-jordan,user-andre}'),
  ('event-2','2026-07-19T09:00:00Z','9:00 AM','SAT','19','Farmers Market on the Promenade','Waterfront Promenade','Community',false,210,'{user-mia,user-hoa,user-jordan}'),
  ('event-3','2026-07-20T17:45:00Z','5:45 PM','SUN','20','Sunset Paddleboard Meetup','Village Marina','Outdoors',false,32,'{user-andre,user-jordan}'),
  ('event-4','2026-07-23T08:00:00Z','8:00 AM','WED','23','Small Business Coffee & Connect','Lakeside Café','Networking',false,19,'{user-riley,user-mia}');

insert into missions (id,title,description,xp,stops_total,icon,position,locked_by_default) values
  ('mission-1','Sunrise at the Marina','Check in at Village Marina before 8 AM.',50,1,'Sun',0,false),
  ('mission-2','Trail Trekker','Complete the 3-mile lakeside loop.',120,3,'ArrowUp',1,false),
  ('mission-3','Taste of the Village','Visit 3 different lakeside eateries.',90,3,'Star',2,false),
  ('mission-4','Fountain Night Owl','Attend a Friday fountain show.',40,1,'Moon',3,true);

insert into mission_progress (mission_id,user_id,stops_done,status) values
  ('mission-1','demo-user',0,'active'),
  ('mission-2','demo-user',2,'active'),
  ('mission-3','demo-user',3,'done'),
  ('mission-4','demo-user',0,'locked');

insert into week_days (date,day_label,date_label,is_today) values
  ('2026-07-14','MON','14',false),
  ('2026-07-15','TUE','15',false),
  ('2026-07-16','WED','16',false),
  ('2026-07-17','THU','17',false),
  ('2026-07-18','FRI','18',true),
  ('2026-07-19','SAT','19',false),
  ('2026-07-20','SUN','20',false);
