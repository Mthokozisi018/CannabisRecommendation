-- Allow verified, preassigned franchise managers to complete the existing personal onboarding flow.
-- Existing staff capacity, store authorization and independent-manager behavior are preserved.

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

  if not found
    or target_profile.temporary_password_active is not true
  then
    raise exception using errcode = '42501', message = 'Manager account setup is not available.';
  end if;

  -- Preassigned franchise managers may finish personal onboarding without
  -- changing their assigned store. Re-read trusted Auth metadata and ownership.
  if target_profile.store_id is not null and not exists (
    select 1
    from auth.users u
    join public.stores s on s.id = target_profile.store_id
    join public.staff_profiles creator on creator.auth_user_id = target_profile.created_by
    where u.id = p_auth_user_id
      and u.raw_app_meta_data->>'greenchoice_role' = 'manager'
      and u.raw_app_meta_data->>'greenchoice_registration' = 'franchise_created'
      and u.raw_app_meta_data->>'greenchoice_store_id' = s.id::text
      and u.raw_app_meta_data->>'greenchoice_created_by' = creator.auth_user_id::text
      and (u.raw_app_meta_data->>'greenchoice_franchise_id' is null
        or u.raw_app_meta_data->>'greenchoice_franchise_id' = s.franchise_id::text)
      and creator.role = 'franchise_admin'
      and creator.franchise_id = s.franchise_id
      and s.franchise_id is not null
      and s.is_active and s.store_access_status = 'active'
      and target_profile.is_active
  ) then
    raise exception using errcode = '42501', message = 'Assigned manager account setup is not available.';
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

comment on function public.complete_manual_manager_account_setup(uuid, text, text, text, text, text, text, text, text, text) is
  'Completes personal setup after the authenticated password change, preserving a verified franchise store assignment or the independent manager flow.';
