-- Mark dedicated customer test accounts without overloading customer status.
-- The marker is intentionally not granted to authenticated clients; customer
-- self-service reads stay on the explicit column grant from the portal migration.

alter table public.customer_profiles
  add column if not exists is_test_account boolean not null default false;

create index if not exists customer_profiles_test_account_idx
  on public.customer_profiles(email)
  where is_test_account;

comment on column public.customer_profiles.is_test_account is
  'Server-managed marker for dedicated GreenChoice QA/customer-test identities. Never set from customer-facing flows.';
