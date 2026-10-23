-- Atomically change the default without changing address data or existing RLS.
create or replace function public.set_customer_default_address(p_address_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  customer_id uuid := auth.uid();
begin
  if customer_id is null then
    raise exception 'Customer authentication is required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(customer_id::text, 0));
  perform 1 from public.customer_addresses
    where id = p_address_id and user_id = customer_id for update;
  if not found then
    raise exception 'Saved address is unavailable';
  end if;
  update public.customer_addresses set is_default = false
    where user_id = customer_id and is_default and id <> p_address_id;
  update public.customer_addresses set is_default = true
    where id = p_address_id and user_id = customer_id;
end;
$$;

revoke all on function public.set_customer_default_address(uuid) from public, anon;
grant execute on function public.set_customer_default_address(uuid) to authenticated;
