-- Businesses asked to advertise more than one special at once (a lunch
-- special AND a happy hour, say), which 0066's single flat `current_special`
-- column couldn't express -- it modeled "one active special per business"
-- as a product decision, not a technical limit, and that decision has now
-- changed. Move to `current_specials text[]`, still not a separate table
-- (still fully replaced on every edit, matching 0066's own reasoning for why
-- this wasn't a running feed of promotional posts), just a list instead of a
-- scalar. Optional stays optional: an empty array means no specials, the
-- same meaning `null` carried before.
--
-- `special_updated_at` is renamed to `specials_updated_at` to match --
-- still the same "when was the specials list last edited" timestamp, just
-- pluralized alongside the column it tracks.

alter table business_listings add column current_specials text[] not null default '{}';
update business_listings set current_specials = array[current_special] where current_special is not null and current_special <> '';
alter table business_listings drop column current_special;
alter table business_listings rename column special_updated_at to specials_updated_at;
