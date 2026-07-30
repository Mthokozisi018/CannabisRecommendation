alter table public.manager_invitations
  add column if not exists temporary_password_issued_at timestamptz,
  add column if not exists temporary_password_auth_user_id uuid references auth.users(id) on delete set null;

alter table public.staff_profiles
  add column if not exists temporary_password_active boolean not null default false,
  add column if not exists password_changed_at timestamptz;

create index if not exists manager_invitations_temp_password_idx
on public.manager_invitations(status, temporary_password_issued_at);

create index if not exists staff_profiles_temp_password_idx
on public.staff_profiles(temporary_password_active, password_changed_at);
