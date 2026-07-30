-- Forward-only correction for invitation onboarding, checkout identity, and
-- manager store registration. This migration is intentionally not applied by
-- application code; deploy it through the controlled Supabase migration path.

alter table public.staff_invitations
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

update public.staff_invitations si
set auth_user_id = au.id
from auth.users au
where si.auth_user_id is null
  and au.raw_user_meta_data ->> 'staff_invitation_id' = si.id::text
  and lower(au.email) = lower(si.email);

create unique index if not exists staff_invitations_auth_user_id_uidx
  on public.staff_invitations(auth_user_id)
  where auth_user_id is not null
    and status in ('pending', 'accepted');

create or replace function public.reserve_receptionist_invitation(
  p_email text,
  p_expires_at timestamptz
)
returns table(
  invitation_id uuid,
  slot_count integer,
  slot_limit integer,
  created boolean,
  result_code text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  manager_store_id uuid;
  normalized_email text := lower(trim(p_email));
  existing_invitation_id uuid;
  used_slots integer;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if normalized_email = '' or length(normalized_email) > 320 then
    raise exception using errcode = '22023', message = 'Invalid invitation request.';
  end if;

  if p_expires_at is null or p_expires_at <= statement_timestamp() or
     p_expires_at > statement_timestamp() + interval '8 days' then
    raise exception using errcode = '22023', message = 'Invalid invitation expiry.';
  end if;

  select sp.store_id
  into manager_store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.auth_user_id, sp.user_id) = caller_id
    and sp.role = 'manager'
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  limit 1;

  if manager_store_id is null then
    raise exception using errcode = '42501', message = 'Manager access denied.';
  end if;

  perform 1
  from public.stores
  where id = manager_store_id
  for update;

  update public.staff_invitations
  set status = 'expired'
  where store_id = manager_store_id
    and status in ('pending', 'accepted')
    and expires_at <= statement_timestamp();

  if exists (
    select 1
    from public.staff_profiles sp
    where lower(sp.email) = normalized_email
      and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) <> 'deleted'
  ) then
    raise exception using errcode = '23505', message = 'A staff account already exists.';
  end if;

  select si.id
  into existing_invitation_id
  from public.staff_invitations si
  where si.store_id = manager_store_id
    and lower(si.email) = normalized_email
    and si.status in ('pending', 'accepted')
    and si.expires_at > statement_timestamp()
    and si.completed_at is null
    and si.revoked_at is null
  order by si.created_at desc
  limit 1;

  select
    (
      select count(*)::integer
      from public.staff_profiles sp
      where sp.store_id = manager_store_id
        and sp.role = 'receptionist'
        and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end)
          in ('active', 'restricted')
    ) +
    (
      select count(*)::integer
      from public.staff_invitations si
      where si.store_id = manager_store_id
        and si.status in ('pending', 'accepted')
        and si.expires_at > statement_timestamp()
        and si.completed_at is null
        and si.revoked_at is null
        and not exists (
          select 1
          from public.staff_profiles sp
          where sp.store_id = manager_store_id
            and sp.role = 'receptionist'
            and lower(sp.email) = lower(si.email)
            and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end)
              in ('active', 'restricted')
        )
    )
  into used_slots;

  if existing_invitation_id is not null then
    invitation_id := existing_invitation_id;
    slot_count := used_slots;
    slot_limit := 5;
    created := false;
    result_code := 'existing_invitation';
    return next;
    return;
  end if;

  if used_slots >= 5 then
    insert into public.audit_logs(user_id, action, table_name, store_id, result, details)
    values (
      caller_id,
      'manager_receptionist_slot_limit_blocked',
      'staff_invitations',
      manager_store_id,
      'rejected',
      jsonb_build_object('slotCount', used_slots, 'slotLimit', 5)
    );

    invitation_id := null;
    slot_count := used_slots;
    slot_limit := 5;
    created := false;
    result_code := 'limit_reached';
    return next;
    return;
  end if;

  insert into public.staff_invitations(
    email,
    store_id,
    intended_role,
    invited_by,
    status,
    expires_at,
    last_sent_at,
    email_delivery_result
  )
  values (
    normalized_email,
    manager_store_id,
    'receptionist',
    caller_id,
    'pending',
    p_expires_at,
    statement_timestamp(),
    'pending'
  )
  returning id into invitation_id;

  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (
    caller_id,
    'manager_reserved_receptionist_slot',
    'staff_invitations',
    invitation_id,
    manager_store_id,
    'created',
    jsonb_build_object('slotCount', used_slots + 1, 'slotLimit', 5)
  );

  slot_count := used_slots + 1;
  slot_limit := 5;
  created := true;
  result_code := 'created';
  return next;
end;
$$;

revoke all on function public.reserve_receptionist_invitation(text, timestamptz) from public, anon;
grant execute on function public.reserve_receptionist_invitation(text, timestamptz) to authenticated;
alter function public.reserve_receptionist_invitation(text, timestamptz) owner to postgres;

create or replace function public.get_receptionist_slot_usage()
returns table(slot_count integer, slot_limit integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  manager_store_id uuid;
begin
  select sp.store_id
  into manager_store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.auth_user_id, sp.user_id) = caller_id
    and sp.role = 'manager'
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  limit 1;

  if manager_store_id is null then
    raise exception using errcode = '42501', message = 'Manager access denied.';
  end if;

  return query
  select
    (
      (
        select count(*)::integer
        from public.staff_profiles sp
        where sp.store_id = manager_store_id
          and sp.role = 'receptionist'
          and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end)
            in ('active', 'restricted')
      ) +
      (
        select count(*)::integer
        from public.staff_invitations si
        where si.store_id = manager_store_id
          and si.status in ('pending', 'accepted')
          and si.expires_at > statement_timestamp()
          and si.completed_at is null
          and si.revoked_at is null
          and not exists (
            select 1
            from public.staff_profiles sp
            where sp.store_id = manager_store_id
              and sp.role = 'receptionist'
              and lower(sp.email) = lower(si.email)
              and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end)
                in ('active', 'restricted')
          )
      )
    )::integer,
    5;
end;
$$;

revoke all on function public.get_receptionist_slot_usage() from public, anon;
grant execute on function public.get_receptionist_slot_usage() to authenticated;
alter function public.get_receptionist_slot_usage() owner to postgres;

drop policy if exists staff_invitations_manager_insert on public.staff_invitations;
drop policy if exists staff_invitations_manager_update on public.staff_invitations;
drop policy if exists staff_invitations_invitee_read on public.staff_invitations;
create policy staff_invitations_invitee_read
on public.staff_invitations for select
using (
  auth_user_id = auth.uid()
  and status in ('pending', 'accepted')
  and expires_at > statement_timestamp()
  and completed_at is null
  and revoked_at is null
  and failed_at is null
);
revoke insert, update, delete on table public.staff_invitations from authenticated;

create or replace function public.complete_staff_onboarding(
  p_invitation_id uuid,
  p_first_name text,
  p_surname text,
  p_mobile_number text,
  p_alternative_phone text,
  p_physical_address text,
  p_city text,
  p_province text,
  p_postal_code text,
  p_country text,
  p_employee_id text,
  p_terms_version text,
  p_privacy_policy_version text
)
returns table(profile_id uuid, store_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  invitation_row public.staff_invitations%rowtype;
  other_slot_count integer;
  created_profile_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select lower(email)
  into caller_email
  from auth.users
  where id = caller_id;

  if caller_email is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if char_length(btrim(coalesce(p_first_name, ''))) not between 2 and 100
    or char_length(btrim(coalesce(p_surname, ''))) not between 2 and 100
    or char_length(btrim(coalesce(p_mobile_number, ''))) not between 10 and 20
    or char_length(btrim(coalesce(p_alternative_phone, ''))) > 20
    or char_length(btrim(coalesce(p_physical_address, ''))) not between 5 and 240
    or char_length(btrim(coalesce(p_city, ''))) not between 2 and 120
    or p_province not in (
      'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
      'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape',
      'Western Cape'
    )
    or btrim(coalesce(p_postal_code, '')) !~ '^[0-9]{4}$'
    or p_country is distinct from 'South Africa'
    or char_length(btrim(coalesce(p_employee_id, ''))) > 80
    or char_length(btrim(coalesce(p_terms_version, ''))) not between 1 and 40
    or char_length(btrim(coalesce(p_privacy_policy_version, ''))) not between 1 and 40
  then
    raise exception using errcode = '22023', message = 'Onboarding details are invalid.';
  end if;

  select *
  into invitation_row
  from public.staff_invitations
  where id = p_invitation_id
  for update;

  if not found or
     invitation_row.status not in ('pending', 'accepted') or
     invitation_row.auth_user_id is distinct from caller_id or
     invitation_row.completed_at is not null or
     invitation_row.revoked_at is not null or
     invitation_row.failed_at is not null or
     invitation_row.expires_at <= statement_timestamp() then
    raise exception using errcode = '42501', message = 'Invitation is not available.';
  end if;

  if lower(invitation_row.email) <> caller_email or invitation_row.intended_role <> 'receptionist' then
    raise exception using errcode = '42501', message = 'Invitation is not available.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(invitation_row.store_id::text, 0));

  if not exists (
    select 1
    from public.stores s
    where s.id = invitation_row.store_id
      and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Invitation is not available.';
  end if;

  if not exists (
    select 1
    from public.staff_profiles sp
    where coalesce(sp.auth_user_id, sp.user_id) = invitation_row.invited_by
      and sp.role = 'manager'
      and sp.store_id = invitation_row.store_id
      and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Invitation is not available.';
  end if;

  if exists (
    select 1
    from public.staff_profiles sp
    where coalesce(sp.auth_user_id, sp.user_id) = caller_id
       or lower(sp.email) = caller_email
  ) then
    raise exception using errcode = '23505', message = 'Staff profile already exists.';
  end if;

  select
    (
      select count(*)::integer
      from public.staff_profiles sp
      where sp.store_id = invitation_row.store_id
        and sp.role = 'receptionist'
        and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end)
          in ('active', 'restricted')
    ) +
    (
      select count(*)::integer
      from public.staff_invitations si
      where si.store_id = invitation_row.store_id
        and si.id <> invitation_row.id
        and si.status in ('pending', 'accepted')
        and si.expires_at > statement_timestamp()
        and si.completed_at is null
        and si.revoked_at is null
    )
  into other_slot_count;

  if other_slot_count >= 5 then
    raise exception using errcode = '23514', message = 'Receptionist slot limit reached.';
  end if;

  insert into public.staff_profiles(
    user_id,
    auth_user_id,
    first_name,
    surname,
    full_name,
    email,
    mobile_number,
    phone_number,
    alternative_phone,
    physical_address,
    city,
    province,
    postal_code,
    country,
    employee_id,
    role,
    account_status,
    is_active,
    created_by,
    store_id,
    account_setup_complete,
    profile_setup_complete,
    store_setup_complete,
    onboarding_completed_at,
    onboarding_complete_seen_at,
    terms_accepted,
    terms_accepted_at,
    privacy_policy_accepted_at,
    terms_version,
    privacy_policy_version
  )
  values (
    caller_id,
    caller_id,
    trim(p_first_name),
    trim(p_surname),
    trim(p_first_name) || ' ' || trim(p_surname),
    caller_email,
    p_mobile_number,
    p_mobile_number,
    nullif(trim(p_alternative_phone), ''),
    trim(p_physical_address),
    trim(p_city),
    trim(p_province),
    trim(p_postal_code),
    trim(p_country),
    nullif(trim(p_employee_id), ''),
    'receptionist',
    'active',
    true,
    invitation_row.invited_by,
    invitation_row.store_id,
    true,
    true,
    true,
    statement_timestamp(),
    statement_timestamp(),
    true,
    statement_timestamp(),
    statement_timestamp(),
    p_terms_version,
    p_privacy_policy_version
  )
  returning id into created_profile_id;

  update public.staff_invitations
  set status = 'completed',
      accepted_at = coalesce(accepted_at, statement_timestamp()),
      completed_at = statement_timestamp()
  where id = invitation_row.id
    and status in ('pending', 'accepted')
    and completed_at is null;

  if not found then
    raise exception using errcode = '40001', message = 'Invitation is not available.';
  end if;

  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (
    caller_id,
    'staff_invitation_onboarding_completed',
    'staff_invitations',
    invitation_row.id,
    invitation_row.store_id,
    'completed',
    jsonb_build_object('staffProfileId', created_profile_id)
  );

  profile_id := created_profile_id;
  store_id := invitation_row.store_id;
  return next;
end;
$$;

revoke all on function public.complete_staff_onboarding(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.complete_staff_onboarding(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;
alter function public.complete_staff_onboarding(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
) owner to postgres;

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
    insert into public.stores(
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
    returning id, store_access_status
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

create or replace function public.complete_receptionist_sale_v2(
  p_checkout_id uuid,
  p_auth_user_id uuid,
  p_items jsonb
)
returns table(sale_id uuid, subtotal numeric, total numeric, already_completed boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  item jsonb;
  product_row record;
  stock_row record;
  sale_uuid uuid;
  staff_store_id uuid;
  existing_sale_store_id uuid;
  existing_sale_staff_id uuid;
  expected_price numeric(12,2);
  requested_quantity integer;
  line_total numeric(12,2);
  running_total numeric(12,2) := 0;
begin
  if p_checkout_id is null or p_auth_user_id is null then
    raise exception using errcode = '22023', message = 'Checkout request is invalid.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_checkout_id::text, 0));

  if jsonb_typeof(p_items) is distinct from 'array' or
     jsonb_array_length(p_items) = 0 or
     jsonb_array_length(p_items) > 100 then
    raise exception using errcode = '22023', message = 'Cart is invalid.';
  end if;

  select sp.store_id
  into staff_store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.auth_user_id, sp.user_id) = p_auth_user_id
    and sp.role in ('manager', 'receptionist')
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  limit 1;

  if staff_store_id is null then
    raise exception using errcode = '42501', message = 'Checkout access denied.';
  end if;

  select ps.id, ps.store_id, ps.staff_user_id, ps.subtotal, ps.total
  into sale_id, existing_sale_store_id, existing_sale_staff_id, subtotal, total
  from public.pos_sales ps
  where ps.checkout_id = p_checkout_id;

  if sale_id is not null then
    if existing_sale_store_id <> staff_store_id or existing_sale_staff_id <> p_auth_user_id then
      raise exception using errcode = '42501', message = 'Checkout access denied.';
    end if;
    already_completed := true;
    return next;
    return;
  end if;

  create temporary table if not exists gc_checkout_items (
    product_id uuid primary key,
    quantity integer not null,
    unit_price numeric(12,2) not null
  ) on commit drop;
  truncate table gc_checkout_items;

  for item in select * from jsonb_array_elements(p_items)
  loop
    begin
      requested_quantity := (item->>'quantity')::integer;
      expected_price := (item->>'unitPrice')::numeric(12,2);
    exception when others then
      raise exception using errcode = '22023', message = 'Cart is invalid.';
    end;

    if requested_quantity is null or requested_quantity <= 0 or
       expected_price is null or expected_price < 0 then
      raise exception using errcode = '22023', message = 'Cart is invalid.';
    end if;

    insert into gc_checkout_items(product_id, quantity, unit_price)
    values ((item->>'productId')::uuid, requested_quantity, expected_price)
    on conflict (product_id) do update
      set quantity = gc_checkout_items.quantity + excluded.quantity,
          unit_price = excluded.unit_price;
  end loop;

  insert into public.pos_sales(checkout_id, store_id, staff_user_id, subtotal, total)
  values (p_checkout_id, staff_store_id, p_auth_user_id, 0, 0)
  returning id into sale_uuid;

  for item in select to_jsonb(ci) from gc_checkout_items ci
  loop
    requested_quantity := (item->>'quantity')::integer;
    expected_price := (item->>'unit_price')::numeric(12,2);

    select p.id, p.product_name, p.category, p.subcategory, p.price,
           p.product_status, p.is_visible_on_pos, p.deleted_at
    into product_row
    from public.products p
    where p.id = (item->>'product_id')::uuid
      and p.store_id = staff_store_id
    for update;

    if product_row.id is null or product_row.deleted_at is not null or
       product_row.product_status <> 'active' or product_row.is_visible_on_pos is false then
      raise exception using errcode = '23514', message = 'Product is unavailable.';
    end if;

    if product_row.price is null or product_row.price::numeric(12,2) <> expected_price then
      raise exception using errcode = '23514', message = 'Product price changed.';
    end if;

    select s.id, s.current_quantity
    into stock_row
    from public.inventory_stock s
    where s.product_id = product_row.id
      and s.store_id = staff_store_id
    for update;

    if stock_row.id is null or stock_row.current_quantity < requested_quantity then
      raise exception using errcode = '23514', message = 'Insufficient stock.';
    end if;

    line_total := expected_price * requested_quantity;
    running_total := running_total + line_total;

    insert into public.pos_sale_items(
      sale_id, product_id, product_name_snapshot, category_snapshot,
      subcategory_snapshot, unit_price, quantity, line_total
    )
    values (
      sale_uuid, product_row.id, coalesce(product_row.product_name, 'Product'),
      product_row.category, product_row.subcategory, expected_price,
      requested_quantity, line_total
    );

    update public.inventory_stock
    set current_quantity = current_quantity - requested_quantity,
        last_updated_by = p_auth_user_id
    where id = stock_row.id
      and store_id = staff_store_id
      and current_quantity >= requested_quantity;

    if not found then
      raise exception using errcode = '40001', message = 'Stock changed.';
    end if;

    insert into public.inventory_movements(
      store_id, product_id, movement_type, quantity_changed,
      previous_quantity, new_quantity, reason, created_by
    )
    values (
      staff_store_id, product_row.id, 'stock_removed', -requested_quantity,
      stock_row.current_quantity, stock_row.current_quantity - requested_quantity,
      'POS checkout sale', p_auth_user_id
    );
  end loop;

  update public.pos_sales
  set subtotal = running_total, total = running_total
  where id = sale_uuid and store_id = staff_store_id;

  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (
    p_auth_user_id,
    'receptionist_completed_pos_sale',
    'pos_sales',
    sale_uuid,
    staff_store_id,
    'completed',
    jsonb_build_object('checkoutId', p_checkout_id, 'total', running_total)
  );

  sale_id := sale_uuid;
  subtotal := running_total;
  total := running_total;
  already_completed := false;
  return next;
end;
$$;

revoke all on function public.complete_receptionist_sale(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.complete_receptionist_sale_v2(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_receptionist_sale_v2(uuid, uuid, jsonb) to service_role;
alter function public.complete_receptionist_sale_v2(uuid, uuid, jsonb) owner to postgres;
