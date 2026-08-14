-- Incomplete manual-manager profiles are authorization records, not completed
-- personal profiles. Keep their personal fields empty until the manager submits
-- the authenticated onboarding form.
alter table public.staff_profiles
  alter column full_name drop not null;

update public.staff_profiles as profile
set full_name = null,
    first_name = null,
    surname = null,
    physical_address = null,
    city = null,
    province = null,
    postal_code = null,
    mobile_number = null,
    phone_number = null
from auth.users as auth_user
where profile.auth_user_id = auth_user.id
  and profile.role = 'manager'
  and profile.account_setup_complete is not true
  and profile.profile_setup_complete is not true
  and profile.temporary_password_active is true
  and coalesce(auth_user.raw_app_meta_data ->> 'greenchoice_role', '') = 'manager'
  and coalesce(auth_user.raw_app_meta_data ->> 'greenchoice_registration', '') = 'manual';

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
  where auth_user_id = caller_id
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
    null,
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
  'Creates an onboarding-incomplete manager authorization profile with empty personal fields for a confirmed, trusted manual manager.';
