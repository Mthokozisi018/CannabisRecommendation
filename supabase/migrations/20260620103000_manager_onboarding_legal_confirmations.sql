alter table public.staff_profiles
  add column if not exists privacy_policy_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists privacy_policy_version text;

alter table public.stores
  add column if not exists store_information_confirmed_at timestamptz,
  add column if not exists store_information_confirmed_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'staff_profiles_account_setup_requires_legal_check') then
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

  if not exists (select 1 from pg_constraint where conname = 'stores_manager_confirmation_required_check') then
    alter table public.stores
      add constraint stores_manager_confirmation_required_check check (
        created_by_manager_id is null
        or (
          store_information_confirmed_at is not null
          and store_information_confirmed_by is not null
        )
      ) not valid;
  end if;
end $$;

create index if not exists staff_profiles_legal_acceptance_idx
on public.staff_profiles(terms_accepted_at, privacy_policy_accepted_at);

create index if not exists stores_information_confirmation_idx
on public.stores(store_information_confirmed_at, store_information_confirmed_by);
