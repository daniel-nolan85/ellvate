-- 0060 added the RLS policy for editing your own check-in's photo but
-- missed the table-level grant underneath it -- an RLS policy only filters
-- which rows a command can see; the role still needs the base UPDATE
-- privilege to attempt the command at all, the same way 0025 already
-- grants select/insert separately from their own policies. Without this,
-- every update attempt fails closed with a permission error before RLS is
-- even evaluated (surfaced to callers as a generic 503 data_request_failed).
grant update on mission_check_ins to authenticated;
