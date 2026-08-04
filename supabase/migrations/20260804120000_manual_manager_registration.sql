-- Manual manager accounts are created in Supabase Auth and explicitly marked in
-- app_metadata. GreenChoice initializes only those trusted Auth users.
create or replace function public.bootstrap_manual_manager_profile()
returns table(profile_id uuid, initialized boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  auth_user auth.users%rowtype;
  existing_profile public.staff_profiles%rowtype;
  sole_admin_id uuid;
  sole_admin_count integer;
  created_profile_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));

  select * into auth_user
  from auth.users
  where id = caller_id
  for update;

  if not found
    or auth_user.email is null
    or auth_user.email_confirmed_at is null
    or auth_user.deleted_at is not null
    or (auth_user.banned_until is not null and auth_user.banned_until > statement_timestamp())
    or coalesce(auth_user.raw_app_meta_data ->> 'greenchoice_role', '') <> 'manager'
    or coalesce(auth_user.raw_app_meta_data ->> 'greenchoice_registration', '') <> 'manual'
  then
    raise exception using errcode = '42501', message = 'Manual manager registration is not authorized.';
  end if;

  select * into existing_profile
  from public.staff_profiles
  where coalesce(auth_user_id, user_id) = caller_id
  limit 1;

  if found then
    if existing_profile.role <> 'manager' then
      raise exception using errcode = '42501', message = 'Existing staff role cannot be changed.';
    end if;
    return query select existing_profile.id, false;
    return;
  end if;

  if exists (
    select 1
    from public.staff_profiles sp
    where lower(sp.email) = lower(auth_user.email)
      and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) <> 'deleted'
  ) then
    raise exception using errcode = '23505', message = 'A GreenChoice profile already uses this email.';
  end if;

  select count(*)::integer
  into sole_admin_count
  from public.staff_profiles
  where role = 'admin'
    and coalesce(account_status, case when is_active then 'active' else 'deactivated' end) = 'active';

  select coalesce(auth_user_id, user_id)
  into sole_admin_id
  from public.staff_profiles
  where role = 'admin'
    and coalesce(account_status, case when is_active then 'active' else 'deactivated' end) = 'active'
  limit 1;

  if sole_admin_count <> 1 or sole_admin_id is null or sole_admin_id = caller_id then
    raise exception using errcode = '42501', message = 'Sole administrator validation failed.';
  end if;

  insert into public.staff_profiles (
    auth_user_id,
    user_id,
    email,
    full_name,
    role,
    is_active,
    account_status,
    created_by,
    store_id,
    account_setup_complete,
    profile_setup_complete,
    store_setup_complete,
    onboarding_completed_at,
    onboarding_complete_seen_at,
    temporary_password_active,
    temporary_password_fingerprint,
    password_changed_at
  ) values (
    caller_id,
    caller_id,
    lower(auth_user.email),
    lower(auth_user.email),
    'manager',
    true,
    'active',
    sole_admin_id,
    null,
    false,
    false,
    false,
    null,
    null,
    true,
    null,
    null
  )
  returning id into created_profile_id;

  insert into public.audit_logs(user_id, action, table_name, record_id, result, details)
  values (
    caller_id,
    'manual_manager_profile_initialized',
    'staff_profiles',
    created_profile_id,
    'success',
    jsonb_build_object('registration', 'manual_supabase', 'temporaryPasswordRequired', true)
  );

  return query select created_profile_id, true;
end;
$$;

alter function public.bootstrap_manual_manager_profile() owner to postgres;
revoke all on function public.bootstrap_manual_manager_profile() from public, anon;
grant execute on function public.bootstrap_manual_manager_profile() to authenticated;

comment on function public.bootstrap_manual_manager_profile() is
  'Creates an onboarding-incomplete manager profile only for a confirmed Auth user carrying trusted manual-manager app_metadata.';

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

  if not found or target_profile.temporary_password_active is not true or target_profile.store_id is not null then
    raise exception using errcode = '42501', message = 'Manager account setup is not available.';
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

-- Preserve manager_invitations for historical/audit purposes, but prevent old
-- invitation sessions from activating manager profiles.
revoke execute on function public.complete_manager_invitation(uuid) from authenticated;
comment on function public.complete_manager_invitation(uuid) is
  'Retired. Manager registration now uses trusted manual Supabase app_metadata and bootstrap_manual_manager_profile().';
