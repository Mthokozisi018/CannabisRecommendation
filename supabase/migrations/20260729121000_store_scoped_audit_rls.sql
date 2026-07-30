-- audit_events is the immutable, structured security/business event stream.
-- audit_logs is retained for existing operational dashboard history. They are
-- deliberately not merged here because current manager/admin views use both.

drop policy if exists manager_audit_logs_select on public.audit_logs;
create policy manager_audit_logs_select
on public.audit_logs for select
using (
  store_id = public.current_staff_store_id()
  and exists (
    select 1
    from public.staff_profiles sp
    join public.stores s on s.id = sp.store_id
    where coalesce(sp.auth_user_id, sp.user_id) = auth.uid()
      and sp.role = 'manager'
      and sp.store_id = audit_logs.store_id
      and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
      and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  )
);

drop policy if exists manager_audit_logs_insert on public.audit_logs;

revoke insert, update, delete on table public.audit_logs from authenticated;
grant select on table public.audit_logs to authenticated;

create or replace function public.write_manager_store_audit_log(
  p_action text,
  p_table_name text,
  p_record_id uuid,
  p_result text,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  caller_store_id uuid;
  created_id uuid;
begin
  select sp.store_id
  into caller_store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.auth_user_id, sp.user_id) = caller_id
    and sp.role = 'manager'
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  limit 1;

  if caller_store_id is null then
    raise exception using errcode = '42501', message = 'Manager access denied.';
  end if;

  if p_action is null or length(trim(p_action)) not between 1 and 120 or
     p_table_name is null or length(trim(p_table_name)) not between 1 and 80 or
     p_result is null or length(trim(p_result)) not between 1 and 40 then
    raise exception using errcode = '22023', message = 'Invalid audit event.';
  end if;

  insert into public.audit_logs(
    user_id, action, table_name, record_id, store_id, result, details
  )
  values (
    caller_id,
    trim(p_action),
    trim(p_table_name),
    p_record_id,
    caller_store_id,
    trim(p_result),
    coalesce(p_details, '{}'::jsonb) - 'password' - 'token' - 'cookie' - 'authorization'
  )
  returning id into created_id;

  return created_id;
end;
$$;

revoke all on function public.write_manager_store_audit_log(text, text, uuid, text, jsonb)
  from public, anon;
grant execute on function public.write_manager_store_audit_log(text, text, uuid, text, jsonb)
  to authenticated;
alter function public.write_manager_store_audit_log(text, text, uuid, text, jsonb)
  owner to postgres;
