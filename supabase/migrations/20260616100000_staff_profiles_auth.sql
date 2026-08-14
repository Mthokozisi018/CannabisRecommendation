create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('manager', 'receptionist')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_profiles_auth_user_id_idx on public.staff_profiles(auth_user_id);
create index if not exists staff_profiles_role_active_idx on public.staff_profiles(role, is_active);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists staff_profiles_touch_updated_at on public.staff_profiles;
create trigger staff_profiles_touch_updated_at
before update on public.staff_profiles
for each row execute function public.touch_updated_at();

create or replace function public.is_greenchoice_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where sp.auth_user_id = auth.uid()
      and sp.role = 'manager'
      and sp.is_active = true
  );
$$;

alter table public.staff_profiles enable row level security;

drop policy if exists staff_profiles_self_read on public.staff_profiles;
create policy staff_profiles_self_read
on public.staff_profiles
for select
using (auth_user_id = auth.uid());

drop policy if exists staff_profiles_manager_read on public.staff_profiles;
create policy staff_profiles_manager_read
on public.staff_profiles
for select
using (public.is_greenchoice_manager());

drop policy if exists staff_profiles_manager_insert on public.staff_profiles;
create policy staff_profiles_manager_insert
on public.staff_profiles
for insert
with check (public.is_greenchoice_manager());

drop policy if exists staff_profiles_manager_update on public.staff_profiles;
create policy staff_profiles_manager_update
on public.staff_profiles
for update
using (public.is_greenchoice_manager())
with check (public.is_greenchoice_manager());

-- Store isolation is added by later forward migrations after staff_profiles gains store_id.
