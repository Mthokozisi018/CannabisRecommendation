create extension if not exists pgcrypto;

alter table public.staff_invitations
  add column if not exists token_hash text,
  add column if not exists cancelled_at timestamptz;

update public.staff_invitations
set cancelled_at = coalesce(cancelled_at, revoked_at)
where revoked_at is not null
  and cancelled_at is null;

create unique index if not exists staff_invitations_token_hash_uidx
on public.staff_invitations(token_hash)
where token_hash is not null;

create index if not exists staff_invitations_invited_by_idx
on public.staff_invitations(invited_by);

create index if not exists staff_invitations_pending_expiry_idx
on public.staff_invitations(status, expires_at)
where status in ('pending','accepted');

alter table public.audit_logs
  add column if not exists store_id uuid references public.stores(id) on delete set null,
  add column if not exists result text;

create index if not exists audit_logs_store_created_idx
on public.audit_logs(store_id, created_at desc);

create index if not exists audit_logs_table_record_idx
on public.audit_logs(table_name, record_id);

create or replace function public.validate_staff_invitation_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  manager_store_id uuid;
  manager_active boolean;
  store_active boolean;
begin
  new.email := lower(trim(new.email));

  if new.intended_role <> 'receptionist' then
    raise exception 'Staff invitations can only be created for receptionist role.';
  end if;

  if new.status in ('revoked','expired','failed') and new.completed_at is not null then
    raise exception 'Completed invitations cannot be marked unavailable.';
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'completed' and new.status <> old.status then
      raise exception 'Completed invitations cannot be reused.';
    end if;

    if old.completed_at is not null and new.completed_at is distinct from old.completed_at then
      raise exception 'Completed invitation timestamp cannot be changed.';
    end if;

    if new.store_id is distinct from old.store_id then
      raise exception 'Invitation store cannot be changed.';
    end if;

    if new.intended_role is distinct from old.intended_role then
      raise exception 'Invitation role cannot be changed.';
    end if;
  end if;

  if new.revoked_at is not null and new.cancelled_at is null then
    new.cancelled_at := new.revoked_at;
  end if;

  select sp.store_id,
         coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
  into manager_store_id, manager_active
  from public.staff_profiles sp
  where coalesce(sp.user_id, sp.auth_user_id) = new.invited_by
    and sp.role = 'manager'
  limit 1;

  if manager_store_id is null or manager_store_id <> new.store_id or manager_active is not true then
    raise exception 'Inviting manager is not permitted for this store.';
  end if;

  select coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  into store_active
  from public.stores s
  where s.id = new.store_id;

  if store_active is not true then
    raise exception 'Invitation store is not active.';
  end if;

  return new;
end;
$$;

drop trigger if exists staff_invitations_validate_write on public.staff_invitations;
create trigger staff_invitations_validate_write
before insert or update on public.staff_invitations
for each row execute function public.validate_staff_invitation_write();

drop policy if exists staff_invitations_manager_insert on public.staff_invitations;
create policy staff_invitations_manager_insert
on public.staff_invitations for insert
with check (
  intended_role = 'receptionist'
  and store_id = public.current_staff_store_id()
  and exists (
    select 1
    from public.staff_profiles sp
    where coalesce(sp.user_id, sp.auth_user_id) = auth.uid()
      and sp.role = 'manager'
      and sp.store_id = staff_invitations.store_id
      and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
  )
);

drop policy if exists staff_invitations_manager_update on public.staff_invitations;
create policy staff_invitations_manager_update
on public.staff_invitations for update
using (
  store_id = public.current_staff_store_id()
  and exists (
    select 1
    from public.staff_profiles sp
    where coalesce(sp.user_id, sp.auth_user_id) = auth.uid()
      and sp.role = 'manager'
      and sp.store_id = staff_invitations.store_id
      and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
  )
)
with check (
  intended_role = 'receptionist'
  and store_id = public.current_staff_store_id()
);

grant execute on function public.validate_staff_invitation_write() to service_role;
