-- Every completed mission now pays out the same flat reward
-- (MISSION_COMPLETION_XP in src/backend/missions/user-progress.ts) instead
-- of a per-mission amount -- the completion check (a photo scanned for a
-- face) can't tell a mission actually done from one faked, so a longer or
-- "harder" mission paying out more than a short one just made the exploit
-- worth more the harder it looks. The per-mission xp column is no longer
-- read or written anywhere.
alter table missions drop column xp;
