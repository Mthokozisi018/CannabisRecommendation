-- Correct the phone regex from the initial customer portal migration.
-- The previous pattern matched a literal backslash instead of a leading plus.
alter table public.customer_profiles
  drop constraint if exists customer_profiles_phone_normalized;

alter table public.customer_profiles
  add constraint customer_profiles_phone_normalized
  check (phone_number ~ '^\+27[0-9]{9}$');
