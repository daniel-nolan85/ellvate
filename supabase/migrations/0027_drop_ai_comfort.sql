-- The Lake Assistant is a constant feature available to every member, not a
-- tiered offering — the "how familiar are you with AI" onboarding step this
-- backed was never actually consulted anywhere in the assistant's behavior,
-- so the column (and the misleading picker) are both being retired.
alter table public.app_users drop column if exists ai_comfort;
