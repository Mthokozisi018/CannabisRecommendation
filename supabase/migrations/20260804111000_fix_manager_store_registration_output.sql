create or replace function public.complete_manager_store_registration(
  p_store_name text,
  p_store_phone_number text,
  p_physical_store_address text,
  p_city text,
  p_province text,
  p_postal_code text,
  p_slug text
)
returns table(store_id uuid, store_access_status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  manager_profile public.staff_profiles%rowtype;
  linked_store public.stores%rowtype;
  resolved_store_id uuid;
  resolved_status text;
begin
  if char_length(btrim(coalesce(p_store_name, ''))) not between 2 and 100
    or char_length(btrim(coalesce(p_store_phone_number, ''))) not between 10 and 20
    or char_length(btrim(coalesce(p_physical_store_address, ''))) not between 5 and 240
    or char_length(btrim(coalesce(p_city, ''))) not between 2 and 120
    or p_province not in (
      'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
      'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape',
      'Western Cape'
    )
    or btrim(coalesce(p_postal_code, '')) !~ '^[0-9]{4}$'
    or btrim(coalesce(p_slug, '')) !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or char_length(btrim(coalesce(p_slug, ''))) > 140
  then
    raise exception using errcode = '22023', message = 'Store registration details are invalid.';
  end if;

  select *
  into manager_profile
  from public.staff_profiles
  where coalesce(auth_user_id, user_id) = caller_id
    and role = 'manager'
    and coalesce(account_status, case when is_active then 'active' else 'deactivated' end) = 'active'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Manager access denied.';
  end if;

  if manager_profile.store_id is not null then
    select *
    into linked_store
    from public.stores
    where id = manager_profile.store_id
    for update;

    if not found or
       (linked_store.created_by_manager_id is not null and linked_store.created_by_manager_id <> caller_id) then
      raise exception using errcode = '42501', message = 'Manager store assignment is invalid.';
    end if;

    update public.stores
    set name = trim(p_store_name),
        address = trim(p_physical_store_address),
        store_address = trim(p_physical_store_address),
        store_phone_number = p_store_phone_number,
        physical_store_address = trim(p_physical_store_address),
        city = trim(p_city),
        province = trim(p_province),
        postal_code = trim(p_postal_code),
        store_information_confirmed_at = statement_timestamp(),
        store_information_confirmed_by = caller_id
    where id = linked_store.id;

    resolved_store_id := linked_store.id;
    resolved_status := coalesce(
      linked_store.store_access_status,
      case when linked_store.is_active then 'active' else 'restricted' end
    );

    if resolved_status <> 'active' then
      insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
      values (
        caller_id,
        'manager_store_registration_preserved_restriction',
        'stores',
        linked_store.id,
        linked_store.id,
        'rejected',
        jsonb_build_object('storeAccessStatus', resolved_status)
      );
    end if;
  else
    insert into public.stores as created_store(
      name,
      slug,
      address,
      store_address,
      store_phone_number,
      physical_store_address,
      city,
      province,
      postal_code,
      created_by_manager_id,
      store_information_confirmed_at,
      store_information_confirmed_by,
      store_access_status,
      is_active
    )
    values (
      trim(p_store_name),
      trim(p_slug),
      trim(p_physical_store_address),
      trim(p_physical_store_address),
      p_store_phone_number,
      trim(p_physical_store_address),
      trim(p_city),
      trim(p_province),
      trim(p_postal_code),
      caller_id,
      statement_timestamp(),
      caller_id,
      'active',
      true
    )
    returning created_store.id, created_store.store_access_status
    into resolved_store_id, resolved_status;
  end if;

  update public.staff_profiles
  set store_id = resolved_store_id,
      store_setup_complete = true,
      onboarding_completed_at = statement_timestamp(),
      onboarding_complete_seen_at = null
  where id = manager_profile.id
    and role = 'manager';

  store_id := resolved_store_id;
  store_access_status := resolved_status;
  return next;
end;
$$;

revoke all on function public.complete_manager_store_registration(
  text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.complete_manager_store_registration(
  text, text, text, text, text, text, text
) to authenticated;
alter function public.complete_manager_store_registration(
  text, text, text, text, text, text, text
) owner to postgres;

comment on function public.complete_manager_store_registration(
  text, text, text, text, text, text, text
) is 'Creates or confirms only the authenticated active manager store and returns its qualified access status.';
