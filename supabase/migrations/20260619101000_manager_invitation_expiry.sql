alter table public.manager_invitations
  add column if not exists expires_at timestamptz;

update public.manager_invitations
set expires_at = invited_at + interval '7 days'
where expires_at is null;

create index if not exists manager_invitations_status_expires_idx
on public.manager_invitations(status, expires_at);
