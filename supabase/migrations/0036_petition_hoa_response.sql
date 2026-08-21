-- Lets an admin record the HOA board's response to a succeeded petition
-- (transcribed from whatever real-world channel the board actually replied
-- through -- this app has no way to ingest an email reply automatically) and
-- notifies every signer once it's posted. Mirrors notify_petition_signers
-- (0035) exactly, just gated on hoa_response_at instead of status.

alter table petitions add column if not exists hoa_response text;
alter table petitions add column if not exists hoa_response_at timestamptz;

create or replace function public.notify_petition_hoa_response() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.hoa_response_at is null and new.hoa_response_at is not null then
    insert into public.notifications (user_id, kind, title, body, data)
    select s.user_id, 'petition', 'The HOA board responded',
      'The board responded to "' || new.title || '".',
      jsonb_build_object('petitionId', new.id)
    from public.petition_signatures s
    join public.app_users u on u.id = s.user_id
    where u.notif_petitions = true;
  end if;
  return new;
end;
$$;

create trigger petitions_notify_hoa_response
after update on petitions
for each row execute function public.notify_petition_hoa_response();
