-- The admin dashboard's service-role client bypasses RLS by design, but
-- BYPASSRLS only skips row-level policy checks -- it does not grant base
-- table-level access. Projects created with "Automatically expose new
-- tables" disabled (the recommended, more explicit setting) don't auto-grant
-- new tables to service_role either, so every table it needs to touch
-- requires an explicit grant. Doing this schema-wide (and via default
-- privileges, for tables created after this migration) avoids repeating this
-- for every future admin-dashboard feature.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
