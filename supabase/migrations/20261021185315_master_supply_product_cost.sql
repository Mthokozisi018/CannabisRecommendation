begin;

alter table public.master_supply_products
  add column if not exists supplier_cost_price numeric(12,2)
  check (supplier_cost_price is null or supplier_cost_price >= 0);

-- The existing master_supply_mutation handles product creation, the initial
-- receipt, and authorization. This wrapper saves the supplier cost in the
-- same database transaction as that mutation.
create or replace function public.master_supply_create_product_with_cost(p_actor uuid, p_data jsonb)
returns uuid language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_cost numeric; v_id uuid; v_franchise uuid;
begin
  if p_data->>'supplierCostPrice' is null then
    raise exception 'Supplier cost price is required.';
  end if;
  v_cost := (p_data->>'supplierCostPrice')::numeric;
  if v_cost <= 0 or v_cost > 1000000 or v_cost <> round(v_cost,2) then
    raise exception 'Supplier cost price is invalid.';
  end if;

  v_id := public.master_supply_mutation(p_actor, 'create_product', p_data);
  select franchise_id into v_franchise from public.staff_profiles
    where auth_user_id=p_actor and role='franchise_admin';
  update public.master_supply_products set supplier_cost_price=v_cost
    where id=v_id and franchise_id=v_franchise;
  if not found then raise exception 'Master product could not be updated.'; end if;
  return v_id;
end $$;

revoke all on function public.master_supply_create_product_with_cost(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.master_supply_create_product_with_cost(uuid,jsonb) to service_role;

commit;
