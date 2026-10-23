alter table public.customer_profiles
  add column if not exists is_test_account boolean not null default false;

comment on column public.customer_profiles.is_test_account is
  'Internal GreenChoice test-account marker. Managed only by trusted server-side admin tooling.';

-- Keep this marker outside normal customer-facing column privileges.
revoke select (is_test_account) on table public.customer_profiles from anon, authenticated;
revoke insert (is_test_account) on table public.customer_profiles from anon, authenticated;
revoke update (is_test_account) on table public.customer_profiles from anon, authenticated;

-- Server-side service-role access remains available through the existing table-level grants.

