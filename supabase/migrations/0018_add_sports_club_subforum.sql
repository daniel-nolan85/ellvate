-- Adds the 'Sports Club' forum category requested alongside Golf/HOA
-- (0016), positioned at the end of the existing list.
insert into subforums (name, position) values
  ('Sports Club', 12)
on conflict (name) do nothing;
