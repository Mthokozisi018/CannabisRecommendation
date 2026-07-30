alter table public.manager_invitations
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

update public.manager_invitations mi
set auth_user_id = coalesce(
  mi.auth_user_id,
  mi.temporary_password_auth_user_id,
  (
    select au.id
    from auth.users au
    where lower(au.email) = lower(mi.email)
      and au.raw_user_meta_data ->> 'invited_role' = 'manager'
      and (
        au.raw_user_meta_data ->> 'invitation_id' = mi.id::text
        or mi.temporary_password_auth_user_id = au.id
      )
    order by au.created_at desc
    limit 1
  )
)
where mi.auth_user_id is null;

create unique index if not exists manager_invitations_auth_user_uidx
  on public.manager_invitations(auth_user_id)
  where auth_user_id is not null and status in ('pending', 'accepted');

create or replace function public.complete_manager_invitation(p_invitation_id uuid)
returns table (
  staff_profile_id uuid,
  invitation_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invitation public.manager_invitations%rowtype;
  v_profile_id uuid;
begin
  if v_user_id is null or v_user_email = '' then
    raise exception using errcode = '42501', message = 'invitation_not_available';
  end if;

  select *
  into v_invitation
  from public.manager_invitations
  where id = p_invitation_id
  for update;

  if not found
    or v_invitation.status <> 'pending'
    or v_invitation.revoked_at is not null
    or v_invitation.accepted_at is not null
    or (v_invitation.expires_at is not null and v_invitation.expires_at <= statement_timestamp())
    or lower(v_invitation.email) <> v_user_email
    or v_invitation.auth_user_id is distinct from v_user_id
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'invitation_id', '') <> p_invitation_id::text
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'invited_role', '') <> 'manager'
  then
    raise exception using errcode = '42501', message = 'invitation_not_available';
  end if;

  if exists (
    select 1
    from public.staff_profiles sp
    where lower(sp.email) = v_user_email
      and coalesce(sp.auth_user_id, sp.user_id) <> v_user_id
      and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) <> 'deleted'
  ) then
    raise exception using errcode = '23505', message = 'invitation_not_available';
  end if;

  insert into public.staff_profiles (
    auth_user_id,
    user_id,
    email,
    full_name,
    role,
    is_active,
    account_status,
    account_setup_complete,
    profile_setup_complete,
    store_setup_complete,
    temporary_password_active,
    temporary_password_fingerprint,
    password_changed_at
  )
  values (
    v_user_id,
    v_user_id,
    v_user_email,
    v_user_email,
    'manager',
    true,
    'active',
    false,
    false,
    false,
    false,
    null,
    statement_timestamp()
  )
  on conflict (auth_user_id) do update
  set
    user_id = excluded.user_id,
    email = excluded.email,
    role = 'manager',
    temporary_password_active = false,
    temporary_password_fingerprint = null,
    password_changed_at = statement_timestamp()
  where public.staff_profiles.role = 'manager'
    and coalesce(public.staff_profiles.account_status, case when public.staff_profiles.is_active then 'active' else 'deactivated' end) = 'active'
  returning id into v_profile_id;

  if v_profile_id is null then
    raise exception using errcode = '42501', message = 'invitation_not_available';
  end if;

  update public.manager_invitations
  set
    status = 'accepted',
    accepted_at = statement_timestamp()
  where id = v_invitation.id
    and status = 'pending';

  if not found then
    raise exception using errcode = '40001', message = 'invitation_not_available';
  end if;

  insert into public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    result,
    details
  )
  values (
    v_user_id,
    'manager_invitation_completed',
    'manager_invitations',
    v_invitation.id,
    'success',
    jsonb_build_object('staffProfileId', v_profile_id)
  );

  return query select v_profile_id, 'accepted'::text;
end;
$$;

alter function public.complete_manager_invitation(uuid) owner to postgres;
revoke all on function public.complete_manager_invitation(uuid) from public, anon;
grant execute on function public.complete_manager_invitation(uuid) to authenticated;

comment on function public.complete_manager_invitation(uuid) is
  'Consumes one exact Supabase manager invitation session and creates the matching manager profile transactionally.';
