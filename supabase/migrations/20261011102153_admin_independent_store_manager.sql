-- Admin registration creates one independent store and its first manager atomically.
-- Auth identities are created blocked by the server and activated after commit.
create or replace function private.create_independent_store_manager(
  p_actor uuid, p_auth_user_id uuid, p_store jsonb
) returns uuid
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  actor public.staff_profiles%rowtype;
  target_user auth.users%rowtype;
  existing_profile public.staff_profiles%rowtype;
  new_store_id uuid;
  new_profile_id uuid;
begin
  select * into actor from public.staff_profiles
    where coalesce(auth_user_id,user_id)=p_actor and role='admin'
      and coalesce(account_status,case when is_active then 'active' else 'deactivated' end)='active'
    for update;
  if actor.id is null or (select count(*) from public.staff_profiles where role='admin'
      and coalesce(account_status,case when is_active then 'active' else 'deactivated' end)='active') <> 1 then
    raise exception 'Sole administrator validation failed.' using errcode='42501';
  end if;
  select * into target_user from auth.users where id=p_auth_user_id for update;
  if target_user.id is null or target_user.email_confirmed_at is null or target_user.deleted_at is not null
    or coalesce(target_user.raw_app_meta_data->>'greenchoice_role','') <> 'manager'
    or coalesce(target_user.raw_app_meta_data->>'greenchoice_registration','') <> 'independent_admin'
    or coalesce(target_user.raw_app_meta_data->>'greenchoice_created_by','') <> p_actor::text then
    raise exception 'Manager provisioning is not authorized.' using errcode='42501';
  end if;
  select * into existing_profile from public.staff_profiles where auth_user_id=p_auth_user_id;
  if found then
    -- Retrying the same identity must never create another store or change its assignment.
    if existing_profile.role='manager' and existing_profile.created_by=p_actor
       and existing_profile.store_id is not null and exists(select 1 from public.stores
         where id=existing_profile.store_id and franchise_id is null) then
      return existing_profile.store_id;
    end if;
    raise exception 'Existing staff assignment cannot be changed.' using errcode='42501';
  end if;
  if target_user.banned_until is null or target_user.banned_until <= statement_timestamp() then
    raise exception 'New identity must remain blocked until provisioning completes.' using errcode='42501';
  end if;
  if p_store is null or jsonb_typeof(p_store)<>'object'
    or char_length(btrim(coalesce(p_store->>'name',''))) not between 2 and 100
    or coalesce(p_store->>'phone','') !~ '^\+27[0-9]{9}$'
    or char_length(btrim(coalesce(p_store->>'address',''))) not between 5 and 240
    or char_length(btrim(coalesce(p_store->>'city',''))) not between 2 and 120
    or coalesce(p_store->>'province','') not in ('Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape')
    or coalesce(p_store->>'postalCode','') !~ '^[0-9]{4}$'
    or coalesce(p_store->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or char_length(p_store->>'slug')>140 then
    raise exception 'Store registration details are invalid.' using errcode='22023';
  end if;
  if exists(select 1 from public.staff_profiles where lower(email)=lower(target_user.email)) then
    raise exception 'An account already exists with this email address.' using errcode='23505';
  end if;
  insert into public.stores(name,slug,address,store_address,physical_store_address,
    store_phone_number,city,province,postal_code,store_access_status,is_active,
    store_information_confirmed_at,store_information_confirmed_by,franchise_id)
  values(btrim(p_store->>'name'),p_store->>'slug',btrim(p_store->>'address'),btrim(p_store->>'address'),btrim(p_store->>'address'),
    p_store->>'phone',btrim(p_store->>'city'),p_store->>'province',p_store->>'postalCode','active',true,
    statement_timestamp(),p_actor,null)
  returning id into new_store_id;
  insert into public.staff_profiles(auth_user_id,user_id,email,full_name,role,is_active,account_status,
    created_by,store_id,franchise_id,account_setup_complete,profile_setup_complete,store_setup_complete,
    temporary_password_active,temporary_password_fingerprint,onboarding_completed_at,onboarding_complete_seen_at,password_changed_at)
  values(p_auth_user_id,p_auth_user_id,lower(target_user.email),null,'manager',true,'active',
    p_actor,new_store_id,null,false,false,true,true,null,null,null,null)
  returning id into new_profile_id;
  insert into public.audit_logs(user_id,action,table_name,record_id,store_id,result,details)
  values(p_actor,'admin_independent_store_manager_created','staff_profiles',new_profile_id,new_store_id,'success',
    jsonb_build_object('managerAuthUserId',p_auth_user_id,'independentStore',true,'onboardingRequired',true));
  return new_store_id;
end $$;
revoke all on function private.create_independent_store_manager(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.create_independent_store_manager(uuid,uuid,jsonb) to service_role;

create or replace function public.create_independent_store_manager(p_actor uuid,p_auth_user_id uuid,p_store jsonb)
returns uuid language sql security invoker set search_path = pg_catalog, public as $$
  select private.create_independent_store_manager(p_actor,p_auth_user_id,p_store);
$$;
revoke all on function public.create_independent_store_manager(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_independent_store_manager(uuid,uuid,jsonb) to service_role;

-- Reuse manager personal/consent setup for managers whose store is already assigned.
create or replace function public.complete_manual_manager_account_setup(
  p_auth_user_id uuid,
  p_full_name text,
  p_surname text,
  p_mobile_number text,
  p_physical_address text,
  p_city text,
  p_province text,
  p_postal_code text,
  p_terms_version text,
  p_privacy_policy_version text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_profile public.staff_profiles%rowtype;
  completed_at timestamptz := statement_timestamp();
begin
  if p_auth_user_id is null
    or char_length(btrim(coalesce(p_full_name, ''))) < 2
    or char_length(btrim(coalesce(p_surname, ''))) < 2
    or char_length(btrim(coalesce(p_mobile_number, ''))) not between 10 and 20
    or char_length(btrim(coalesce(p_physical_address, ''))) < 5
    or char_length(btrim(coalesce(p_city, ''))) < 2
    or p_province not in ('Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape')
    or btrim(coalesce(p_postal_code, '')) !~ '^[0-9]{4}$'
    or char_length(btrim(coalesce(p_terms_version, ''))) not between 1 and 40
    or char_length(btrim(coalesce(p_privacy_policy_version, ''))) not between 1 and 40
  then
    raise exception using errcode = '22023', message = 'Manager account details are invalid.';
  end if;

  select * into target_profile
  from public.staff_profiles
  where coalesce(auth_user_id, user_id) = p_auth_user_id
    and role = 'manager'
    and coalesce(account_status, case when is_active then 'active' else 'deactivated' end) = 'active'
  for update;

  if not found or target_profile.temporary_password_active is not true then
    raise exception using errcode = '42501', message = 'Manager account setup is not available.';
  end if;

  if target_profile.store_id is not null and not exists (
    select 1 from public.stores where id=target_profile.store_id and store_access_status='active' and is_active
  ) then
    raise exception 'Assigned store is not active.' using errcode='42501';
  end if;

  update public.staff_profiles
  set full_name = btrim(p_full_name),
      first_name = split_part(btrim(p_full_name), ' ', 1),
      surname = btrim(p_surname),
      mobile_number = btrim(p_mobile_number),
      phone_number = btrim(p_mobile_number),
      physical_address = btrim(p_physical_address),
      city = btrim(p_city),
      province = p_province,
      postal_code = btrim(p_postal_code),
      terms_accepted = true,
      terms_accepted_at = completed_at,
      privacy_policy_accepted_at = completed_at,
      terms_version = p_terms_version,
      privacy_policy_version = p_privacy_policy_version,
      account_setup_complete = true,
      profile_setup_complete = true,
      temporary_password_active = false,
      temporary_password_fingerprint = null,
      password_changed_at = completed_at,
      onboarding_completed_at = case when target_profile.store_setup_complete then completed_at else onboarding_completed_at end,
      auth_user_id = p_auth_user_id,
      user_id = p_auth_user_id
  where id = target_profile.id;

  insert into public.audit_logs(user_id, action, table_name, record_id, result, details)
  values (
    p_auth_user_id,
    'manual_manager_account_setup_completed',
    'staff_profiles',
    target_profile.id,
    'success',
    jsonb_build_object('temporaryPasswordReplaced', true, 'legalAgreementsAccepted', true)
  );

  return target_profile.id;
end;
$$;

alter function public.complete_manual_manager_account_setup(uuid, text, text, text, text, text, text, text, text, text) owner to postgres;
revoke all on function public.complete_manual_manager_account_setup(uuid, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_manual_manager_account_setup(uuid, text, text, text, text, text, text, text, text, text) to service_role;
