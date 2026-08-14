alter table public.staff_profiles
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists postal_code text,
  add column if not exists onboarding_complete_seen_at timestamptz,
  add column if not exists temporary_password_fingerprint text;

-- This constraint was introduced NOT VALID so legacy manager rows could remain.
-- PostgreSQL still enforces a NOT VALID check when any column on such a row is
-- updated, so preserve the legacy row while backfilling only the new timestamp.
alter table public.staff_profiles
  drop constraint if exists staff_profiles_account_setup_requires_legal_check;

update public.staff_profiles
set onboarding_complete_seen_at = coalesce(onboarding_complete_seen_at, onboarding_completed_at, now())
where role = 'manager'
  and coalesce(account_setup_complete, profile_setup_complete, false) = true
  and coalesce(store_setup_complete, false) = true
  and store_id is not null
  and onboarding_complete_seen_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'staff_profiles_account_setup_requires_legal_check'
      and conrelid = 'public.staff_profiles'::regclass
  ) then
    alter table public.staff_profiles
      add constraint staff_profiles_account_setup_requires_legal_check check (
        account_setup_complete is not true
        or (
          terms_accepted_at is not null
          and privacy_policy_accepted_at is not null
          and terms_version is not null
          and privacy_policy_version is not null
        )
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'staff_profiles_manager_province_check'
      and conrelid = 'public.staff_profiles'::regclass
  ) then
    alter table public.staff_profiles
      add constraint staff_profiles_manager_province_check check (
        province is null or province in (
          'Eastern Cape',
          'Free State',
          'Gauteng',
          'KwaZulu-Natal',
          'Limpopo',
          'Mpumalanga',
          'Northern Cape',
          'North West',
          'Western Cape'
        )
      );
  end if;
end $$;

create index if not exists staff_profiles_manager_onboarding_seen_idx
on public.staff_profiles(role, onboarding_complete_seen_at)
where role = 'manager';

create index if not exists staff_profiles_temporary_password_fingerprint_idx
on public.staff_profiles(temporary_password_fingerprint)
where temporary_password_fingerprint is not null;
