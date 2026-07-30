create extension if not exists pgcrypto;

alter table public.stores
  add column if not exists address text,
  add column if not exists store_address text,
  add column if not exists store_access_status text not null default 'active';

update public.stores
set store_access_status = case when is_active then 'active' else 'restricted' end
where store_access_status is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stores_store_access_status_check') then
    alter table public.stores
      add constraint stores_store_access_status_check check (store_access_status in ('active','restricted'));
  end if;
end $$;

alter table public.staff_profiles
  add column if not exists store_id uuid references public.stores(id) on delete set null,
  add column if not exists profile_setup_complete boolean not null default false,
  add column if not exists store_setup_complete boolean not null default false;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.staff_profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%role%'
  loop
    execute format('alter table public.staff_profiles drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table public.staff_profiles
  add constraint staff_profiles_role_check check (role in ('admin','manager','receptionist'));

create index if not exists staff_profiles_store_role_idx on public.staff_profiles(store_id, role);
create index if not exists stores_access_status_idx on public.stores(store_access_status);

create table if not exists public.manager_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  last_sent_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists manager_invitations_pending_email_uidx
on public.manager_invitations (lower(email))
where status = 'pending';

drop trigger if exists manager_invitations_touch_updated_at on public.manager_invitations;
create trigger manager_invitations_touch_updated_at
before update on public.manager_invitations
for each row execute function public.touch_updated_at();

create or replace function public.is_greenchoice_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where coalesce(sp.user_id, sp.auth_user_id) = auth.uid()
      and sp.role = 'admin'
      and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
  );
$$;

create or replace function public.is_store_access_active(target_store uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.stores s
    where s.id = target_store
      and s.store_access_status = 'active'
  );
$$;

create or replace function public.is_greenchoice_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.staff_profiles sp
    left join public.stores s on s.id = sp.store_id
    where coalesce(sp.user_id, sp.auth_user_id) = auth.uid()
      and sp.role = 'manager'
      and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
      and coalesce(s.store_access_status, 'active') = 'active'
  );
$$;

create or replace function public.is_greenchoice_receptionist()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.staff_profiles sp
    left join public.stores s on s.id = sp.store_id
    where coalesce(sp.user_id, sp.auth_user_id) = auth.uid()
      and sp.role = 'receptionist'
      and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
      and coalesce(s.store_access_status, 'active') = 'active'
  );
$$;

create or replace function public.is_store_member(target_store uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_greenchoice_admin()
    or exists (
      select 1 from public.store_memberships sm
      join public.stores s on s.id = sm.store_id
      where sm.store_id = target_store
        and sm.user_id = auth.uid()
        and s.store_access_status = 'active'
    )
    or exists (
      select 1 from public.staff_profiles sp
      join public.stores s on s.id = sp.store_id
      where sp.store_id = target_store
        and coalesce(sp.user_id, sp.auth_user_id) = auth.uid()
        and sp.role in ('manager','receptionist')
        and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
        and s.store_access_status = 'active'
    );
$$;

create or replace function public.has_store_role(target_store uuid, roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_greenchoice_admin()
    or exists (
      select 1 from public.store_memberships sm
      join public.stores s on s.id = sm.store_id
      where sm.store_id = target_store
        and sm.user_id = auth.uid()
        and sm.role = any(roles)
        and s.store_access_status = 'active'
    )
    or exists (
      select 1 from public.staff_profiles sp
      join public.stores s on s.id = sp.store_id
      where sp.store_id = target_store
        and coalesce(sp.user_id, sp.auth_user_id) = auth.uid()
        and (
          (sp.role = 'manager' and ('admin' = any(roles) or 'catalog_manager' = any(roles) or 'manager' = any(roles)))
          or (sp.role = 'receptionist' and ('receptionist' = any(roles)))
        )
        and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
        and s.store_access_status = 'active'
    );
$$;

create or replace function public.mark_manager_invitation_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'manager' then
    update public.manager_invitations
    set status = 'accepted',
        accepted_at = coalesce(accepted_at, now())
    where lower(email) = lower(new.email)
      and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists staff_profiles_mark_invitation_accepted on public.staff_profiles;
create trigger staff_profiles_mark_invitation_accepted
after insert or update of role, email on public.staff_profiles
for each row execute function public.mark_manager_invitation_accepted();

alter table public.manager_invitations enable row level security;

drop policy if exists admin_read_stores on public.stores;
create policy admin_read_stores on public.stores for select using (public.is_greenchoice_admin());
drop policy if exists admin_update_store_access on public.stores;
create policy admin_update_store_access on public.stores for update using (public.is_greenchoice_admin()) with check (public.is_greenchoice_admin());

drop policy if exists staff_profiles_admin_read on public.staff_profiles;
create policy staff_profiles_admin_read on public.staff_profiles for select using (public.is_greenchoice_admin());
drop policy if exists staff_profiles_admin_insert on public.staff_profiles;
create policy staff_profiles_admin_insert on public.staff_profiles for insert with check (public.is_greenchoice_admin());
drop policy if exists staff_profiles_admin_update on public.staff_profiles;
create policy staff_profiles_admin_update on public.staff_profiles for update using (public.is_greenchoice_admin()) with check (public.is_greenchoice_admin());

drop policy if exists manager_invitations_admin_read on public.manager_invitations;
create policy manager_invitations_admin_read on public.manager_invitations for select using (public.is_greenchoice_admin());
drop policy if exists manager_invitations_admin_insert on public.manager_invitations;
create policy manager_invitations_admin_insert on public.manager_invitations for insert with check (public.is_greenchoice_admin());
drop policy if exists manager_invitations_admin_update on public.manager_invitations;
create policy manager_invitations_admin_update on public.manager_invitations for update using (public.is_greenchoice_admin()) with check (public.is_greenchoice_admin());

drop policy if exists admin_audit_logs_read on public.audit_logs;
create policy admin_audit_logs_read on public.audit_logs for select using (public.is_greenchoice_admin());
drop policy if exists admin_audit_logs_insert on public.audit_logs;
create policy admin_audit_logs_insert on public.audit_logs for insert with check (public.is_greenchoice_admin());

grant select, insert, update on table public.manager_invitations to authenticated;
grant select, update on table public.stores to authenticated;
grant all privileges on table public.manager_invitations, public.stores, public.staff_profiles, public.audit_logs to service_role;
