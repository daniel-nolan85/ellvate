-- push_tokens.token is the primary key (one row per physical device/install,
-- see 0001_core_schema.sql), so re-registering the same device under a
-- different Clerk user -- someone signs out and a different person signs in
-- on the same phone, or a dev/QA device gets reused across test accounts --
-- is a real path, not a hypothetical one. storePushTokenSupabase's plain
-- `.upsert(..., { onConflict: 'token' })` 503s in that case: the ON CONFLICT
-- DO UPDATE path is governed by "update own push token" (0003), whose USING
-- clause is checked against the EXISTING row -- still owned by the previous
-- user -- not the new caller, so RLS rejects the statement outright.
--
-- A plain client-side delete-then-insert doesn't fix this either: the new
-- caller has no permission to delete a row they don't own (same RLS shape).
-- This needs a SECURITY DEFINER function, mirroring toggle_bookmark /
-- toggle_petition_signature's existing pattern for a write that legitimately
-- needs to affect a row outside the caller's own row.
create or replace function public.claim_push_token(
  p_token text,
  p_platform text
) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user_id text := public.clerk_user_id();
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.push_tokens where token = p_token and user_id <> v_user_id;

  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, v_user_id, p_platform, now())
  on conflict (token) do update
    set platform = excluded.platform, updated_at = excluded.updated_at;
end;
$$;

grant execute on function public.claim_push_token(text, text) to authenticated;
