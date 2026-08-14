alter table public.staff_profiles
  add column if not exists phone_number text,
  add column if not exists terms_accepted boolean not null default false,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists account_setup_complete boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz;

update public.staff_profiles
set
  phone_number = coalesce(phone_number, mobile_number),
  account_setup_complete = coalesce(account_setup_complete, profile_setup_complete, false)
where role = 'manager';

update public.staff_profiles
set
  account_setup_complete = true,
  profile_setup_complete = true,
  store_setup_complete = true,
  onboarding_completed_at = coalesce(onboarding_completed_at, now())
where role = 'manager'
  and store_id is not null
  and coalesce(account_status, case when is_active then 'active' else 'deactivated' end) = 'active';

alter table public.stores
  add column if not exists store_contact_email text,
  add column if not exists store_phone_number text,
  add column if not exists physical_store_address text,
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists postal_code text,
  add column if not exists business_registration_number text,
  add column if not exists cannabis_license_or_permit_number text,
  add column if not exists created_by_manager_id uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stores_province_check') then
    alter table public.stores
      add constraint stores_province_check check (
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

create index if not exists stores_created_by_manager_idx on public.stores(created_by_manager_id);
