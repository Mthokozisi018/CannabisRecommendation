create or replace function public.update_receptionist_account_status(
  p_staff_profile_id uuid,
  p_account_status text
)
returns table(
  previous_status text,
  account_status text,
  slot_count integer,
  slot_limit integer,
  denial_reason text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_store_id uuid;
  v_target public.staff_profiles%rowtype;
  v_used_slots integer;
begin
  if v_actor_id is null
    or p_staff_profile_id is null
    or p_account_status not in ('active', 'restricted', 'deactivated')
  then
    raise exception using errcode = '22023', message = 'invalid_status_request';
  end if;

  select sp.store_id
  into v_store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.auth_user_id, sp.user_id) = v_actor_id
    and sp.role = 'manager'
    and coalesce(
      sp.account_status,
      case when sp.is_active then 'active' else 'deactivated' end
    ) = 'active'
    and coalesce(
      s.store_access_status,
      case when s.is_active then 'active' else 'restricted' end
    ) = 'active'
  limit 1;

  if v_store_id is null then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  perform 1
  from public.stores s
  where s.id = v_store_id
  for update;

  select *
  into v_target
  from public.staff_profiles sp
  where sp.id = p_staff_profile_id
    and sp.store_id = v_store_id
    and sp.role = 'receptionist'
    and coalesce(
      sp.account_status,
      case when sp.is_active then 'active' else 'deactivated' end
    ) <> 'deleted'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  previous_status := coalesce(
    v_target.account_status,
    case when v_target.is_active then 'active' else 'deactivated' end
  );

  select
    (
      select count(*)::integer
      from public.staff_profiles sp
      where sp.store_id = v_store_id
        and sp.role = 'receptionist'
        and sp.id <> v_target.id
        and coalesce(
          sp.account_status,
          case when sp.is_active then 'active' else 'deactivated' end
        ) in ('active', 'restricted')
    ) +
    (
      select count(*)::integer
      from public.staff_invitations si
      where si.store_id = v_store_id
        and si.status in ('pending', 'accepted')
        and si.expires_at > statement_timestamp()
        and si.completed_at is null
        and si.revoked_at is null
        and si.failed_at is null
        and (
          p_account_status not in ('active', 'restricted')
          or lower(si.email) <> lower(v_target.email)
        )
        and not exists (
          select 1
          from public.staff_profiles occupied_profile
          where occupied_profile.store_id = v_store_id
            and occupied_profile.role = 'receptionist'
            and occupied_profile.id <> v_target.id
            and lower(occupied_profile.email) = lower(si.email)
            and coalesce(
              occupied_profile.account_status,
              case when occupied_profile.is_active then 'active' else 'deactivated' end
            ) in ('active', 'restricted')
        )
    )
  into v_used_slots;

  if p_account_status in ('active', 'restricted')
    and previous_status not in ('active', 'restricted')
    and v_used_slots >= 5
  then
    insert into public.audit_logs(
      user_id,
      action,
      table_name,
      record_id,
      store_id,
      result,
      details
    )
    values (
      v_actor_id,
      'manager_receptionist_reactivation_slot_limit_blocked',
      'staff_profiles',
      v_target.id,
      v_store_id,
      'rejected',
      jsonb_build_object('slotCount', v_used_slots, 'slotLimit', 5)
    );

    account_status := previous_status;
    slot_count := v_used_slots;
    slot_limit := 5;
    denial_reason := 'receptionist_slot_limit_reached';
    return next;
    return;
  end if;

  update public.staff_profiles
  set account_status = p_account_status,
      is_active = p_account_status = 'active',
      deleted_at = null
  where id = v_target.id
    and store_id = v_store_id
    and role = 'receptionist';

  account_status := p_account_status;
  slot_count := v_used_slots + case when p_account_status in ('active', 'restricted') then 1 else 0 end;
  slot_limit := 5;
  denial_reason := null;

  insert into public.audit_logs(
    user_id,
    action,
    table_name,
    record_id,
    store_id,
    result,
    details
  )
  values (
    v_actor_id,
    case p_account_status
      when 'active' then 'manager_granted_staff_access'
      when 'restricted' then 'manager_restricted_staff_access'
      else 'manager_deactivated_staff_account'
    end,
    'staff_profiles',
    v_target.id,
    v_store_id,
    'completed',
    jsonb_build_object(
      'previousStatus', previous_status,
      'accountStatus', p_account_status,
      'slotCount', slot_count,
      'slotLimit', 5
    )
  );

  return next;
end;
$$;

alter function public.update_receptionist_account_status(uuid, text)
  owner to postgres;
revoke all on function public.update_receptionist_account_status(uuid, text)
  from public, anon;
grant execute on function public.update_receptionist_account_status(uuid, text)
  to authenticated;

comment on function public.update_receptionist_account_status(uuid, text) is
  'Updates a manager-owned receptionist status under the store lock and prevents reactivation from exceeding five occupied slots.';
