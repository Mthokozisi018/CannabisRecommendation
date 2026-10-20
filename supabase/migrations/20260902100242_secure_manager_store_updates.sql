create or replace function public.update_own_manager_store(
  p_store jsonb,
  p_fulfillment jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_store_id uuid;
  v_store_name text := nullif(btrim(p_store->>'name'), '');
  v_description text := nullif(btrim(p_store->>'publicDescription'), '');
  v_contact_email text := nullif(lower(btrim(p_store->>'contactEmail')), '');
  v_phone text := nullif(btrim(p_store->>'phoneNumber'), '');
  v_address text := nullif(btrim(p_store->>'physicalAddress'), '');
  v_city text := nullif(btrim(p_store->>'city'), '');
  v_province text := nullif(btrim(p_store->>'province'), '');
  v_postal_code text := nullif(btrim(p_store->>'postalCode'), '');
  v_opening_hours jsonb := p_store->'openingHours';
  v_orders_enabled boolean;
  v_collection_enabled boolean;
  v_delivery_enabled boolean;
  v_collection_lead_minutes integer;
  v_collection_minimum numeric(12,2);
  v_collection_fee numeric(12,2);
  v_delivery_minimum numeric(12,2);
  v_delivery_fee numeric(12,2);
  v_delivery_eta_min_minutes integer;
  v_delivery_eta_max_minutes integer;
  v_delivery_radius_km numeric(7,2);
  v_day text;
  v_hours jsonb;
begin
  if v_caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select sp.store_id
  into v_store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.auth_user_id, sp.user_id) = v_caller_id
    and sp.role = 'manager'
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
    and s.slug <> 'greenchoice-admin-demo-store'
  limit 1
  for update of s;

  if v_store_id is null then
    raise exception using errcode = '42501', message = 'An active manager store is required.';
  end if;

  if v_store_name is null or char_length(v_store_name) not between 2 and 100 then
    raise exception using errcode = '22023', message = 'Store name must be between 2 and 100 characters.';
  end if;
  if v_description is not null and char_length(v_description) > 1000 then
    raise exception using errcode = '22023', message = 'Store description must be 1000 characters or fewer.';
  end if;
  if v_contact_email is not null and (char_length(v_contact_email) > 254 or v_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception using errcode = '22023', message = 'Enter a valid store contact email.';
  end if;
  if v_phone is null or v_phone !~ '^\+27[0-9]{9}$' then
    raise exception using errcode = '22023', message = 'Enter a valid South African store phone number.';
  end if;
  if v_address is null or char_length(v_address) not between 5 and 240 then
    raise exception using errcode = '22023', message = 'Store address must be between 5 and 240 characters.';
  end if;
  if v_city is null or char_length(v_city) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'City must be between 2 and 120 characters.';
  end if;
  if v_province is null or v_province not in (
    'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
    'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'
  ) then
    raise exception using errcode = '22023', message = 'Select a valid South African province.';
  end if;
  if v_postal_code is null or v_postal_code !~ '^[0-9]{4}$' then
    raise exception using errcode = '22023', message = 'Postal code must be 4 digits.';
  end if;

  if jsonb_typeof(v_opening_hours) <> 'object' then
    raise exception using errcode = '22023', message = 'Opening hours are required.';
  end if;
  foreach v_day in array array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] loop
    v_hours := v_opening_hours->v_day;
    if jsonb_typeof(v_hours) <> 'object'
      or not (v_hours ? 'closed')
      or jsonb_typeof(v_hours->'closed') <> 'boolean'
      or (
        not (v_hours->>'closed')::boolean
        and (
          coalesce(v_hours->>'open', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          or coalesce(v_hours->>'close', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          or v_hours->>'open' = v_hours->>'close'
        )
      )
    then
      raise exception using errcode = '22023', message = format('Enter valid opening hours for %s.', initcap(v_day));
    end if;
  end loop;

  begin
    v_orders_enabled := (p_fulfillment->>'ordersEnabled')::boolean;
    v_collection_enabled := (p_fulfillment->>'collectionEnabled')::boolean;
    v_delivery_enabled := (p_fulfillment->>'deliveryEnabled')::boolean;
    v_collection_lead_minutes := (p_fulfillment->>'collectionLeadMinutes')::integer;
    v_collection_minimum := (p_fulfillment->>'collectionMinimum')::numeric;
    v_collection_fee := (p_fulfillment->>'collectionFee')::numeric;
    v_delivery_minimum := (p_fulfillment->>'deliveryMinimum')::numeric;
    v_delivery_fee := (p_fulfillment->>'deliveryFee')::numeric;
    v_delivery_eta_min_minutes := nullif(p_fulfillment->>'deliveryEtaMinMinutes', '')::integer;
    v_delivery_eta_max_minutes := nullif(p_fulfillment->>'deliveryEtaMaxMinutes', '')::integer;
    v_delivery_radius_km := nullif(p_fulfillment->>'deliveryRadiusKm', '')::numeric;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'Fulfillment settings contain invalid values.';
  end;

  if v_orders_enabled is null or v_collection_enabled is null or v_delivery_enabled is null
    or v_collection_lead_minutes is null or v_collection_minimum is null
    or v_collection_fee is null or v_delivery_minimum is null or v_delivery_fee is null
    or v_collection_lead_minutes not between 0 and 1440
    or v_collection_minimum < 0 or v_collection_fee < 0
    or v_delivery_minimum < 0 or v_delivery_fee < 0
    or (v_delivery_eta_min_minutes is not null and v_delivery_eta_min_minutes not between 1 and 1440)
    or (v_delivery_eta_max_minutes is not null and v_delivery_eta_max_minutes not between 1 and 1440)
    or (v_delivery_eta_min_minutes is not null and v_delivery_eta_max_minutes is not null and v_delivery_eta_max_minutes < v_delivery_eta_min_minutes)
    or (v_delivery_radius_km is not null and (v_delivery_radius_km <= 0 or v_delivery_radius_km > 500))
    or (v_delivery_enabled and (v_delivery_eta_min_minutes is null or v_delivery_eta_max_minutes is null or v_delivery_radius_km is null))
  then
    raise exception using errcode = '22023', message = 'Fulfillment settings are outside the allowed range.';
  end if;

  update public.stores
  set name = v_store_name,
      public_description = v_description,
      store_contact_email = v_contact_email,
      store_phone_number = v_phone,
      address = v_address,
      store_address = v_address,
      physical_store_address = v_address,
      city = v_city,
      province = v_province,
      postal_code = v_postal_code,
      opening_hours = v_opening_hours,
      updated_at = now()
  where id = v_store_id;

  insert into public.store_fulfillment_settings (
    store_id, orders_enabled, collection_enabled, delivery_enabled,
    collection_lead_minutes, collection_minimum, collection_fee,
    delivery_minimum, delivery_fee, delivery_eta_min_minutes,
    delivery_eta_max_minutes, delivery_radius_km, updated_at
  ) values (
    v_store_id, v_orders_enabled, v_collection_enabled, v_delivery_enabled,
    v_collection_lead_minutes, v_collection_minimum, v_collection_fee,
    v_delivery_minimum, v_delivery_fee, v_delivery_eta_min_minutes,
    v_delivery_eta_max_minutes, v_delivery_radius_km, now()
  )
  on conflict (store_id) do update set
    orders_enabled = excluded.orders_enabled,
    collection_enabled = excluded.collection_enabled,
    delivery_enabled = excluded.delivery_enabled,
    collection_lead_minutes = excluded.collection_lead_minutes,
    collection_minimum = excluded.collection_minimum,
    collection_fee = excluded.collection_fee,
    delivery_minimum = excluded.delivery_minimum,
    delivery_fee = excluded.delivery_fee,
    delivery_eta_min_minutes = excluded.delivery_eta_min_minutes,
    delivery_eta_max_minutes = excluded.delivery_eta_max_minutes,
    delivery_radius_km = excluded.delivery_radius_km,
    updated_at = excluded.updated_at;

  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (
    v_caller_id,
    'manager_updated_own_store',
    'stores',
    v_store_id,
    v_store_id,
    'success',
    jsonb_build_object(
      'source', 'manage_store',
      'fulfillmentUpdated', true,
      'openingHoursUpdated', true
    )
  );

  return v_store_id;
end;
$$;

alter function public.update_own_manager_store(jsonb, jsonb) owner to postgres;
revoke all on function public.update_own_manager_store(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_own_manager_store(jsonb, jsonb) to authenticated;

comment on function public.update_own_manager_store(jsonb, jsonb) is
  'Updates only the active store derived from the authenticated manager. No client-supplied store identifier is accepted.';
