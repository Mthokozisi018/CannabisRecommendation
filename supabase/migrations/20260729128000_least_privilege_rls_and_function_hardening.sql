-- Tighten the shared authorization helpers and remove table-write paths that
-- bypass GreenChoice's transactional server operations.

create or replace function public.is_greenchoice_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where coalesce(sp.auth_user_id, sp.user_id) = auth.uid()
      and sp.role = 'admin'
      and coalesce(
        sp.account_status,
        case when sp.is_active then 'active' else 'deactivated' end
      ) = 'active'
  );
$$;

create or replace function public.current_staff_store_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select sp.store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.auth_user_id, sp.user_id) = auth.uid()
    and sp.role in ('manager', 'receptionist')
    and coalesce(
      sp.account_status,
      case when sp.is_active then 'active' else 'deactivated' end
    ) = 'active'
    and coalesce(
      s.store_access_status,
      case when s.is_active then 'active' else 'restricted' end
    ) = 'active'
  limit 1;
$$;

create or replace function public.is_greenchoice_manager()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    join public.stores s on s.id = sp.store_id
    where coalesce(sp.auth_user_id, sp.user_id) = auth.uid()
      and sp.role = 'manager'
      and coalesce(
        sp.account_status,
        case when sp.is_active then 'active' else 'deactivated' end
      ) = 'active'
      and coalesce(
        s.store_access_status,
        case when s.is_active then 'active' else 'restricted' end
      ) = 'active'
  );
$$;

create or replace function public.is_greenchoice_staff()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.current_staff_store_id() is not null;
$$;

create or replace function public.is_greenchoice_receptionist()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    join public.stores s on s.id = sp.store_id
    where coalesce(sp.auth_user_id, sp.user_id) = auth.uid()
      and sp.role = 'receptionist'
      and coalesce(
        sp.account_status,
        case when sp.is_active then 'active' else 'deactivated' end
      ) = 'active'
      and coalesce(
        s.store_access_status,
        case when s.is_active then 'active' else 'restricted' end
      ) = 'active'
  );
$$;

create or replace function public.is_store_access_active(target_store uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.stores s
    where s.id = target_store
      and coalesce(
        s.store_access_status,
        case when s.is_active then 'active' else 'restricted' end
      ) = 'active'
  );
$$;

create or replace function public.is_store_member(target_store uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select target_store is not null
    and (
      public.is_greenchoice_admin()
      or exists (
        select 1
        from public.store_memberships sm
        join public.stores s on s.id = sm.store_id
        where sm.store_id = target_store
          and sm.user_id = auth.uid()
          and coalesce(
            s.store_access_status,
            case when s.is_active then 'active' else 'restricted' end
          ) = 'active'
      )
      or exists (
        select 1
        from public.staff_profiles sp
        join public.stores s on s.id = sp.store_id
        where sp.store_id = target_store
          and coalesce(sp.auth_user_id, sp.user_id) = auth.uid()
          and sp.role in ('manager', 'receptionist')
          and coalesce(
            sp.account_status,
            case when sp.is_active then 'active' else 'deactivated' end
          ) = 'active'
          and coalesce(
            s.store_access_status,
            case when s.is_active then 'active' else 'restricted' end
          ) = 'active'
      )
    );
$$;

create or replace function public.has_store_role(target_store uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select target_store is not null
    and roles is not null
    and (
      public.is_greenchoice_admin()
      or exists (
        select 1
        from public.store_memberships sm
        join public.stores s on s.id = sm.store_id
        where sm.store_id = target_store
          and sm.user_id = auth.uid()
          and sm.role = any(roles)
          and coalesce(
            s.store_access_status,
            case when s.is_active then 'active' else 'restricted' end
          ) = 'active'
      )
      or exists (
        select 1
        from public.staff_profiles sp
        join public.stores s on s.id = sp.store_id
        where sp.store_id = target_store
          and coalesce(sp.auth_user_id, sp.user_id) = auth.uid()
          and (
            (
              sp.role = 'manager'
              and (
                'manager' = any(roles)
                or 'catalog_manager' = any(roles)
              )
            )
            or (
              sp.role = 'receptionist'
              and 'receptionist' = any(roles)
            )
          )
          and coalesce(
            sp.account_status,
            case when sp.is_active then 'active' else 'deactivated' end
          ) = 'active'
          and coalesce(
            s.store_access_status,
            case when s.is_active then 'active' else 'restricted' end
          ) = 'active'
      )
    );
$$;

alter function public.is_greenchoice_admin() owner to postgres;
alter function public.current_staff_store_id() owner to postgres;
alter function public.is_greenchoice_manager() owner to postgres;
alter function public.is_greenchoice_staff() owner to postgres;
alter function public.is_greenchoice_receptionist() owner to postgres;
alter function public.is_store_access_active(uuid) owner to postgres;
alter function public.is_store_member(uuid) owner to postgres;
alter function public.has_store_role(uuid, text[]) owner to postgres;

revoke all on function public.is_greenchoice_admin() from public, anon;
revoke all on function public.current_staff_store_id() from public, anon;
revoke all on function public.is_greenchoice_manager() from public, anon;
revoke all on function public.is_greenchoice_staff() from public, anon;
revoke all on function public.is_greenchoice_receptionist() from public, anon;
revoke all on function public.is_store_access_active(uuid) from public, anon;
revoke all on function public.is_store_member(uuid) from public, anon;
revoke all on function public.has_store_role(uuid, text[]) from public, anon;

grant execute on function public.is_greenchoice_admin() to authenticated, service_role;
grant execute on function public.current_staff_store_id() to authenticated, service_role;
grant execute on function public.is_greenchoice_manager() to authenticated, service_role;
grant execute on function public.is_greenchoice_staff() to authenticated, service_role;
grant execute on function public.is_greenchoice_receptionist() to authenticated, service_role;
grant execute on function public.is_store_access_active(uuid) to authenticated, service_role;
grant execute on function public.is_store_member(uuid) to authenticated, service_role;
grant execute on function public.has_store_role(uuid, text[]) to authenticated, service_role;

drop policy if exists staff_profiles_store_manager_read on public.staff_profiles;
drop policy if exists staff_profiles_store_manager_insert on public.staff_profiles;
drop policy if exists staff_profiles_store_manager_update on public.staff_profiles;
drop policy if exists staff_profiles_manager_insert on public.staff_profiles;
drop policy if exists staff_profiles_manager_update on public.staff_profiles;

create policy staff_profiles_store_manager_read
on public.staff_profiles
for select
using (
  public.is_greenchoice_admin()
  or coalesce(auth_user_id, user_id) = auth.uid()
  or (
    public.is_greenchoice_manager()
    and store_id = public.current_staff_store_id()
    and role in ('manager', 'receptionist')
  )
);

drop policy if exists manager_audit_logs_insert on public.audit_logs;
drop policy if exists admin_audit_logs_insert on public.audit_logs;

drop policy if exists audit_admin_read on public.audit_events;
drop policy if exists audit_admin_insert on public.audit_events;
drop policy if exists audit_events_authorized_read on public.audit_events;
create policy audit_events_authorized_read
on public.audit_events
for select
using (
  public.is_greenchoice_admin()
  or (
    public.is_greenchoice_manager()
    and store_id = public.current_staff_store_id()
  )
);

drop policy if exists products_store_insert on public.products;
drop policy if exists products_store_update on public.products;
drop policy if exists inventory_stock_store_insert on public.inventory_stock;
drop policy if exists inventory_stock_store_update on public.inventory_stock;
drop policy if exists inventory_movements_store_insert on public.inventory_movements;
drop policy if exists manager_products_insert on public.products;
drop policy if exists manager_products_update on public.products;
drop policy if exists manager_inventory_stock_insert on public.inventory_stock;
drop policy if exists manager_inventory_stock_update on public.inventory_stock;
drop policy if exists manager_inventory_movements_insert on public.inventory_movements;

revoke insert, update, delete on table public.products from authenticated;
revoke insert, update, delete on table public.inventory_stock from authenticated;
revoke insert, update, delete on table public.inventory_movements from authenticated;
revoke insert, update, delete on table public.staff_profiles from authenticated;
revoke insert, update, delete on table public.audit_logs from authenticated;
revoke insert, update, delete on table public.audit_events from authenticated;
revoke insert, update, delete on table public.manager_invitations from authenticated;
revoke update, delete on table public.stores from authenticated;

grant select on table public.products to authenticated;
grant select on table public.inventory_stock to authenticated;
grant select on table public.inventory_movements to authenticated;
grant select on table public.staff_profiles to authenticated;
grant select on table public.audit_logs to authenticated;
grant select on table public.audit_events to authenticated;

-- Historical SECURITY DEFINER helpers remain for compatibility, but receive a
-- fixed path even when their execution has been superseded or revoked.
alter function public.set_inventory_row_store_id()
  set search_path = pg_catalog, public;
alter function public.mark_manager_invitation_accepted()
  set search_path = pg_catalog, public;
alter function public.validate_staff_invitation_write()
  set search_path = pg_catalog, public;
alter function public.complete_receptionist_sale(uuid, uuid, jsonb)
  set search_path = pg_catalog, public;

revoke all on function public.validate_staff_invitation_write()
  from public, anon, authenticated;
revoke all on function public.complete_receptionist_sale(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

comment on policy audit_events_authorized_read on public.audit_events is
  'Platform administrators may read all events. Active managers may read events for only their current active store.';
