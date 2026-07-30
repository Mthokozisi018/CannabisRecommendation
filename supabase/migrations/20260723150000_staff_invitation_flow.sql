create extension if not exists pgcrypto;

alter table public.staff_profiles
  drop constraint if exists staff_profiles_account_status_check;

alter table public.staff_profiles
  add constraint staff_profiles_account_status_check
  check (account_status in ('active','restricted','deactivated','deleted'));

create table if not exists public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  intended_role text not null default 'receptionist',
  invited_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  last_sent_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  revoked_at timestamptz,
  failed_at timestamptz,
  email_delivery_result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_invitations_role_check check (intended_role = 'receptionist'),
  constraint staff_invitations_status_check check (status in ('pending','accepted','completed','expired','revoked','failed'))
);

create unique index if not exists staff_invitations_pending_store_email_uidx
on public.staff_invitations (store_id, lower(email))
where status in ('pending','accepted');

create index if not exists staff_invitations_store_status_idx
on public.staff_invitations(store_id, status, expires_at);

drop trigger if exists staff_invitations_touch_updated_at on public.staff_invitations;
create trigger staff_invitations_touch_updated_at
before update on public.staff_invitations
for each row execute function public.touch_updated_at();

alter table public.staff_invitations enable row level security;

drop policy if exists staff_invitations_manager_read on public.staff_invitations;
create policy staff_invitations_manager_read
on public.staff_invitations for select
using (
  exists (
    select 1
    from public.staff_profiles sp
    where coalesce(sp.user_id, sp.auth_user_id) = auth.uid()
      and sp.role = 'manager'
      and sp.store_id = staff_invitations.store_id
      and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
  )
);

grant select on table public.staff_invitations to authenticated;
grant all privileges on table public.staff_invitations to service_role;
