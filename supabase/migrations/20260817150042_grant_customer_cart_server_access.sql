-- Customer cart API routes use the server-only Supabase service role to read
-- and mutate draft carts after application-level customer, origin, store, and
-- stock checks. RLS remains enabled for browser roles.

grant select, insert, update
  on table public.carts
  to service_role;

grant select, insert, update, delete
  on table public.cart_items
  to service_role;
