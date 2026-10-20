begin;

-- Preserve the useful canonical test-account index as a forward migration,
-- without changing the migration already recorded in production history.
create index if not exists customer_profiles_test_account_idx
  on public.customer_profiles(user_id) where is_test_account = true;

-- The current POS uses the customer-bound v2 operation through service-only v3.
-- The obsolete three-argument operation must not provide an alternate checkout.
revoke all on function public.complete_receptionist_sale_v2(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

commit;
