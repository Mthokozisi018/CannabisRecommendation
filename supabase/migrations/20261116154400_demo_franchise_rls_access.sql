begin;

-- The public demo may browse its preassigned fictional franchise without
-- manufacturing legal acceptance or completion of account setup. Normal
-- franchise administrators retain every existing onboarding prerequisite.
create or replace function private.current_franchise_id() returns uuid
language sql stable security definer set search_path = pg_catalog, public, private as $$
  select franchise_id from public.staff_profiles
  where auth.uid() is not null and auth_user_id=auth.uid() and role='franchise_admin'
    and account_status='active' and is_active
    and (
      (account_setup_complete and temporary_password_active=false
       and password_changed_at is not null and terms_accepted_at is not null
       and privacy_policy_accepted_at is not null)
      or franchise_id=(select private.demo_franchise_id())
    );
$$;

commit;
