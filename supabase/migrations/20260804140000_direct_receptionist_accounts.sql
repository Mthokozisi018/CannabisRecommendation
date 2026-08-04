-- Replace receptionist email invitations with manager-created Auth accounts.
-- Auth users are created by the server-side Admin API; these functions bind
-- profile creation and first-login completion to trusted app_metadata.

create or replace function public.create_manager_receptionist_profile(
  p_auth_user_id uuid,
  p_email text
)
returns table(profile_id uuid, assigned_store_id uuid, slot_count integer, slot_limit integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  manager_profile public.staff_profiles%rowtype;
  target_user auth.users%rowtype;
  occupied_slots integer;
  created_profile_id uuid;
begin
  if caller_id is null or p_auth_user_id is null or normalized_email = '' or length(normalized_email) > 320 then
    raise exception using errcode = '22023', message = 'invalid_receptionist_account_request';
  end if;

  select sp.*
  into manager_profile
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where sp.auth_user_id = caller_id
    and sp.role = 'manager'
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active';

  if not found or manager_profile.store_id is null then
    raise exception using errcode = '42501', message = 'manager_access_denied';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(manager_profile.store_id::text, 0));
  perform 1 from public.stores where id = manager_profile.store_id for update;

  select *
  into target_user
  from auth.users
  where id = p_auth_user_id
  for update;

  if not found
    or p_auth_user_id = caller_id
    or target_user.email is null
    or lower(target_user.email) <> normalized_email
    or target_user.email_confirmed_at is null
    or target_user.deleted_at is not null
    or (target_user.banned_until is not null and target_user.banned_until > statement_timestamp())
    or coalesce(target_user.raw_app_meta_data ->> 'greenchoice_role', '') <> 'receptionist'
    or coalesce(target_user.raw_app_meta_data ->> 'greenchoice_registration', '') <> 'manager_created'
    or coalesce(target_user.raw_app_meta_data ->> 'greenchoice_store_id', '') <> manager_profile.store_id::text
    or coalesce(target_user.raw_app_meta_data ->> 'greenchoice_manager_id', '') <> caller_id::text
  then
    raise exception using errcode = '42501', message = 'receptionist_auth_identity_invalid';
  end if;

  if exists (
    select 1
    from public.staff_profiles sp
    where sp.auth_user_id = p_auth_user_id
       or sp.user_id = p_auth_user_id
       or lower(sp.email) = normalized_email
  ) then
    raise exception using errcode = '23505', message = 'receptionist_account_already_exists';
  end if;

  select count(*)::integer
  into occupied_slots
  from public.staff_profiles sp
  where sp.store_id = manager_profile.store_id
    and sp.role = 'receptionist'
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) in ('active', 'restricted');

  if occupied_slots >= 5 then
    insert into public.audit_logs(user_id, action, table_name, store_id, result, details)
    values (
      caller_id,
      'manager_receptionist_slot_limit_blocked',
      'staff_profiles',
      manager_profile.store_id,
      'rejected',
      jsonb_build_object('slotCount', occupied_slots, 'slotLimit', 5)
    );
    raise exception using errcode = '23514', message = 'receptionist_slot_limit_reached';
  end if;

  insert into public.staff_profiles(
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
    password_changed_at,
    terms_accepted,
    terms_accepted_at,
    privacy_policy_accepted_at,
    terms_version,
    privacy_policy_version
  ) values (
    p_auth_user_id,
    p_auth_user_id,
    normalized_email,
    null,
    'receptionist',
    true,
    'active',
    caller_id,
    manager_profile.store_id,
    false,
    false,
    true,
    null,
    null,
    true,
    null,
    null,
    false,
    null,
    null,
    null,
    null
  )
  returning id into created_profile_id;

  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (
    caller_id,
    'manager_created_receptionist_account',
    'staff_profiles',
    created_profile_id,
    manager_profile.store_id,
    'success',
    jsonb_build_object('role', 'receptionist', 'temporaryPasswordRequired', true, 'slotCount', occupied_slots + 1, 'slotLimit', 5)
  );

  return query select created_profile_id, manager_profile.store_id, occupied_slots + 1, 5;
end;
$$;

alter function public.create_manager_receptionist_profile(uuid, text) owner to postgres;
revoke all on function public.create_manager_receptionist_profile(uuid, text) from public, anon;
grant execute on function public.create_manager_receptionist_profile(uuid, text) to authenticated;

create or replace function public.complete_manager_created_receptionist_setup(
  p_first_name text,
  p_surname text,
  p_mobile_number text,
  p_terms_version text,
  p_privacy_policy_version text
)
returns table(profile_id uuid, assigned_store_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  auth_user auth.users%rowtype;
  receptionist_profile public.staff_profiles%rowtype;
  completed_at timestamptz := statement_timestamp();
begin
  if caller_id is null
    or char_length(btrim(coalesce(p_first_name, ''))) not between 2 and 100
    or char_length(btrim(coalesce(p_surname, ''))) not between 2 and 100
    or char_length(btrim(coalesce(p_mobile_number, ''))) not between 10 and 20
    or char_length(btrim(coalesce(p_terms_version, ''))) not between 1 and 40
    or char_length(btrim(coalesce(p_privacy_policy_version, ''))) not between 1 and 40
  then
    raise exception using errcode = '22023', message = 'receptionist_setup_details_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));

  select * into auth_user
  from auth.users
  where id = caller_id
  for update;

  select * into receptionist_profile
  from public.staff_profiles
  where auth_user_id = caller_id
  for update;

  if auth_user.id is null
    or receptionist_profile.id is null
    or auth_user.email is null
    or auth_user.email_confirmed_at is null
    or auth_user.deleted_at is not null
    or (auth_user.banned_until is not null and auth_user.banned_until > completed_at)
    or receptionist_profile.role <> 'receptionist'
    or receptionist_profile.store_id is null
    or receptionist_profile.created_by is null
    or lower(receptionist_profile.email) <> lower(auth_user.email)
    or coalesce(receptionist_profile.account_status, case when receptionist_profile.is_active then 'active' else 'deactivated' end) <> 'active'
    or receptionist_profile.temporary_password_active is not true
    or coalesce(auth_user.raw_app_meta_data ->> 'greenchoice_role', '') <> 'receptionist'
    or coalesce(auth_user.raw_app_meta_data ->> 'greenchoice_registration', '') <> 'manager_created'
    or coalesce(auth_user.raw_app_meta_data ->> 'greenchoice_store_id', '') <> receptionist_profile.store_id::text
    or coalesce(auth_user.raw_app_meta_data ->> 'greenchoice_manager_id', '') <> receptionist_profile.created_by::text
  then
    raise exception using errcode = '42501', message = 'receptionist_setup_not_available';
  end if;

  if not exists (
    select 1 from public.stores s
    where s.id = receptionist_profile.store_id
      and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  ) then
    raise exception using errcode = '42501', message = 'receptionist_store_not_available';
  end if;

  update public.staff_profiles
  set first_name = btrim(p_first_name),
      surname = btrim(p_surname),
      full_name = btrim(p_first_name) || ' ' || btrim(p_surname),
      mobile_number = btrim(p_mobile_number),
      phone_number = btrim(p_mobile_number),
      terms_accepted = true,
      terms_accepted_at = completed_at,
      privacy_policy_accepted_at = completed_at,
      terms_version = p_terms_version,
      privacy_policy_version = p_privacy_policy_version,
      account_setup_complete = true,
      profile_setup_complete = true,
      store_setup_complete = true,
      onboarding_completed_at = completed_at,
      onboarding_complete_seen_at = completed_at,
      temporary_password_active = false,
      temporary_password_fingerprint = null,
      password_changed_at = completed_at
  where id = receptionist_profile.id
    and auth_user_id = caller_id
    and role = 'receptionist';

  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (
    caller_id,
    'receptionist_account_setup_completed',
    'staff_profiles',
    receptionist_profile.id,
    receptionist_profile.store_id,
    'success',
    jsonb_build_object('temporaryPasswordReplaced', true, 'legalAgreementsAccepted', true)
  );

  return query select receptionist_profile.id, receptionist_profile.store_id;
end;
$$;

alter function public.complete_manager_created_receptionist_setup(text, text, text, text, text) owner to postgres;
revoke all on function public.complete_manager_created_receptionist_setup(text, text, text, text, text) from public, anon;
grant execute on function public.complete_manager_created_receptionist_setup(text, text, text, text, text) to authenticated;

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
  where sp.auth_user_id = caller_id
    and sp.role = 'manager'
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active';

  if manager_store_id is null then
    raise exception using errcode = '42501', message = 'manager_access_denied';
  end if;

  return query
  select count(*)::integer, 5
  from public.staff_profiles sp
  where sp.store_id = manager_store_id
    and sp.role = 'receptionist'
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) in ('active', 'restricted');
end;
$$;

alter function public.get_receptionist_slot_usage() owner to postgres;
revoke all on function public.get_receptionist_slot_usage() from public, anon;
grant execute on function public.get_receptionist_slot_usage() to authenticated;

create or replace function public.update_receptionist_account_status(
  p_staff_profile_id uuid,
  p_account_status text
)
returns table(previous_status text, account_status text, slot_count integer, slot_limit integer, denial_reason text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  manager_store_id uuid;
  target_profile public.staff_profiles%rowtype;
  other_occupied_slots integer;
begin
  if actor_id is null or p_staff_profile_id is null or p_account_status not in ('active', 'restricted', 'deactivated') then
    raise exception using errcode = '22023', message = 'invalid_status_request';
  end if;

  select sp.store_id
  into manager_store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where sp.auth_user_id = actor_id
    and sp.role = 'manager'
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active';

  if manager_store_id is null then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(manager_store_id::text, 0));
  perform 1 from public.stores where id = manager_store_id for update;

  select * into target_profile
  from public.staff_profiles sp
  where sp.id = p_staff_profile_id
    and sp.store_id = manager_store_id
    and sp.role = 'receptionist'
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) <> 'deleted'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  previous_status := coalesce(target_profile.account_status, case when target_profile.is_active then 'active' else 'deactivated' end);

  select count(*)::integer into other_occupied_slots
  from public.staff_profiles sp
  where sp.store_id = manager_store_id
    and sp.role = 'receptionist'
    and sp.id <> target_profile.id
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) in ('active', 'restricted');

  if p_account_status in ('active', 'restricted')
    and previous_status not in ('active', 'restricted')
    and other_occupied_slots >= 5
  then
    account_status := previous_status;
    slot_count := other_occupied_slots;
    slot_limit := 5;
    denial_reason := 'receptionist_slot_limit_reached';
    return next;
    return;
  end if;

  update public.staff_profiles
  set account_status = p_account_status,
      is_active = p_account_status = 'active',
      deleted_at = null
  where id = target_profile.id;

  account_status := p_account_status;
  slot_count := other_occupied_slots + case when p_account_status in ('active', 'restricted') then 1 else 0 end;
  slot_limit := 5;
  denial_reason := null;

  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (
    actor_id,
    case p_account_status when 'active' then 'manager_granted_staff_access' when 'restricted' then 'manager_restricted_staff_access' else 'manager_deactivated_staff_account' end,
    'staff_profiles',
    target_profile.id,
    manager_store_id,
    'completed',
    jsonb_build_object('previousStatus', previous_status, 'accountStatus', p_account_status, 'slotCount', slot_count, 'slotLimit', 5)
  );

  return next;
end;
$$;

alter function public.update_receptionist_account_status(uuid, text) owner to postgres;
revoke all on function public.update_receptionist_account_status(uuid, text) from public, anon;
grant execute on function public.update_receptionist_account_status(uuid, text) to authenticated;

-- Preserve invitation rows for audit, but ensure they cannot drive registration.
update public.staff_invitations
set status = 'revoked',
    revoked_at = coalesce(revoked_at, statement_timestamp()),
    email_delivery_result = 'retired_direct_account_flow'
where status in ('pending', 'accepted');

drop policy if exists staff_invitations_invitee_read on public.staff_invitations;
drop policy if exists staff_invitations_manager_read on public.staff_invitations;
revoke select on table public.staff_invitations from authenticated;
revoke all on function public.reserve_receptionist_invitation(text, timestamptz) from public, anon, authenticated;
revoke all on function public.complete_staff_onboarding(uuid, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;

comment on function public.create_manager_receptionist_profile(uuid, text) is
  'Creates a store-scoped, onboarding-incomplete receptionist profile for a trusted manager-created Auth user under the five-account store lock.';
comment on function public.complete_manager_created_receptionist_setup(text, text, text, text, text) is
  'Completes first-login receptionist setup without allowing role or store changes.';
