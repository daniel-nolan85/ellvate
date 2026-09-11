-- Theme was purely decorative (picks which icon shows on a mission card --
-- see src/modules/missions/mission-theme.ts) but was required to create a
-- mission. Dropping the NOT NULL constraint so admins aren't forced to pick
-- one just to publish -- src/modules/missions/mission-theme.ts falls back
-- to a generic icon when it's unset.
alter table missions alter column theme drop not null;
