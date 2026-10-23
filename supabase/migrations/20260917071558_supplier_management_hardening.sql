create index supplier_categories_supplier_store_idx on public.supplier_categories(supplier_id, store_id);
create index suppliers_created_by_idx on public.suppliers(created_by) where created_by is not null;
create index suppliers_updated_by_idx on public.suppliers(updated_by) where updated_by is not null;
create index supply_deliveries_supplier_store_idx on public.supply_deliveries(supplier_id, store_id);
create index supply_deliveries_recorded_by_idx on public.supply_deliveries(recorded_by) where recorded_by is not null;
create index supply_delivery_items_delivery_store_idx on public.supply_delivery_items(delivery_id, store_id);
create index supply_delivery_items_product_idx on public.supply_delivery_items(product_id);

drop policy if exists suppliers_manager_select on public.suppliers;
create policy suppliers_manager_select on public.suppliers
for select to authenticated
using ((select public.is_greenchoice_manager()) and store_id = (select public.current_staff_store_id()));

drop policy if exists supplier_categories_manager_select on public.supplier_categories;
create policy supplier_categories_manager_select on public.supplier_categories
for select to authenticated
using ((select public.is_greenchoice_manager()) and store_id = (select public.current_staff_store_id()));

drop policy if exists supply_deliveries_manager_select on public.supply_deliveries;
create policy supply_deliveries_manager_select on public.supply_deliveries
for select to authenticated
using ((select public.is_greenchoice_manager()) and store_id = (select public.current_staff_store_id()));

drop policy if exists supply_delivery_items_manager_select on public.supply_delivery_items;
create policy supply_delivery_items_manager_select on public.supply_delivery_items
for select to authenticated
using ((select public.is_greenchoice_manager()) and store_id = (select public.current_staff_store_id()));

create or replace function public.create_product_without_stock_atomic(
  p_store_id uuid,
  p_product_name text,
  p_category text,
  p_subcategory text,
  p_cultivation_type text,
  p_price numeric,
  p_product_status text,
  p_package_count integer,
  p_thc_per_unit_mg numeric,
  p_thc_per_packet_mg numeric,
  p_initial_stock integer,
  p_low_stock_threshold integer
)
returns table(product_id uuid, current_quantity integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_initial_stock is distinct from 0 then
    raise exception using errcode = '22023', message = 'supplier_required_for_initial_stock';
  end if;

  return query
  select created.product_id, created.current_quantity
  from public.create_product_with_inventory(
    p_store_id,
    p_product_name,
    p_category,
    p_subcategory,
    p_cultivation_type,
    p_price,
    p_product_status,
    p_package_count,
    p_thc_per_unit_mg,
    p_thc_per_packet_mg,
    0,
    p_low_stock_threshold
  ) created;
end;
$$;

revoke all on function public.create_product_without_stock_atomic(uuid, text, text, text, text, numeric, text, integer, numeric, numeric, integer, integer) from public, anon;
grant execute on function public.create_product_without_stock_atomic(uuid, text, text, text, text, numeric, text, integer, numeric, numeric, integer, integer) to authenticated;
revoke execute on function public.create_product_with_inventory(uuid, text, text, text, text, numeric, text, integer, numeric, numeric, integer, integer) from authenticated;

comment on function public.create_product_without_stock_atomic(uuid, text, text, text, text, numeric, text, integer, numeric, numeric, integer, integer) is
  'Creates a product only when initial stock is zero. Positive initial stock must use create_product_with_supply_atomic.';
