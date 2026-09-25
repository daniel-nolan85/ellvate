-- Adds 'other' to business_listings' category set, mirroring
-- service_listings' own 'other' bucket (0020) -- the Businesses filter
-- pills need a catch-all too (hotels, mail/shipping services, and anything
-- else that doesn't fit restaurants-bars/goods/hospitality/professional-trade).

alter table business_listings drop constraint if exists business_listings_category_check;
alter table business_listings add constraint business_listings_category_check
  check (category in ('restaurants-bars', 'goods', 'hospitality', 'professional-trade', 'other'));
