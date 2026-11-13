-- Any active supplier registered to the manager store may supply multiple products.
-- Keep store, product, quantity, cost, movement, delivery, and audit checks.
create or replace function public.receive_inventory_stock_atomic(
  p_product_id uuid,
  p_supplier_id uuid,
  p_quantity integer,
  p_unit_cost numeric,
  p_reason text default 'supplier_delivery'
)
returns table(
  stock_id uuid,
  previous_quantity integer,
  new_quantity integer,
  delivery_id uuid,
  delivery_reference text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_store_id uuid;
  v_product record;
  v_stock record;
  v_movement_id uuid;
  v_delivery_id uuid := gen_random_uuid();
  v_delivery_reference text := 'SUP-' || upper(substr(replace(v_delivery_id::text, '-', ''), 1, 10));
  v_line_total numeric(14,2);
  v_unit text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  select public.current_staff_store_id() into v_store_id;
  if v_store_id is null or not public.is_greenchoice_manager() then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if p_product_id is null or p_supplier_id is null or p_quantity is null or p_quantity <= 0 or p_quantity > 1000000
    or p_unit_cost is null or p_unit_cost < 0 or p_unit_cost > 1000000 or round(p_unit_cost, 2) <> p_unit_cost
  then
    raise exception using errcode = '22023', message = 'invalid_supply_intake';
  end if;

  select p.id, p.product_name, p.category, p.subcategory, p.cultivation_type
  into v_product
  from public.products p
  where p.id = p_product_id and p.store_id = v_store_id and p.deleted_at is null;
  if v_product.id is null then
    raise exception using errcode = '23503', message = 'product_unavailable';
  end if;

  if not exists (
    select 1 from public.suppliers s
    where s.id = p_supplier_id and s.store_id = v_store_id and s.status = 'active'
  ) then
    raise exception using errcode = '23514', message = 'supplier_not_authorized_for_store';
  end if;

  select s.id, s.current_quantity
  into v_stock
  from public.inventory_stock s
  where s.product_id = p_product_id and s.store_id = v_store_id
  for update;
  if v_stock.id is null or v_stock.current_quantity is null or v_stock.current_quantity <> trunc(v_stock.current_quantity) then
    raise exception using errcode = '23514', message = 'inventory_stock_invalid';
  end if;

  stock_id := v_stock.id;
  previous_quantity := v_stock.current_quantity::integer;
  new_quantity := previous_quantity + p_quantity;
  v_line_total := round(p_quantity * p_unit_cost, 2);
  v_unit := case when v_product.category = 'Flower' then 'grams' else 'units' end;

  update public.inventory_stock
  set current_quantity = new_quantity, last_updated_by = v_user_id
  where id = v_stock.id and store_id = v_store_id;

  insert into public.inventory_movements(store_id, product_id, movement_type, quantity_changed, previous_quantity, new_quantity, reason, created_by)
  values (v_store_id, p_product_id, 'stock_added', p_quantity, previous_quantity, new_quantity, left(coalesce(nullif(btrim(p_reason), ''), 'supplier_delivery'), 240), v_user_id)
  returning id into v_movement_id;

  insert into public.supply_deliveries(id, store_id, supplier_id, reference, recorded_by, total_cost)
  values (v_delivery_id, v_store_id, p_supplier_id, v_delivery_reference, v_user_id, v_line_total);

  insert into public.supply_delivery_items(
    delivery_id, store_id, product_id, inventory_movement_id, product_name_snapshot,
    category_snapshot, subcategory_snapshot, cultivation_type_snapshot,
    quantity, unit, unit_cost, line_total
  )
  values (
    v_delivery_id, v_store_id, p_product_id, v_movement_id, coalesce(v_product.product_name, 'Product'),
    v_product.category, v_product.subcategory, v_product.cultivation_type,
    p_quantity, v_unit, p_unit_cost, v_line_total
  );

  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (
    v_user_id,
    'manager_received_supplier_stock',
    'supply_deliveries',
    v_delivery_id,
    v_store_id,
    'completed',
    jsonb_build_object('productId', p_product_id, 'supplierId', p_supplier_id, 'quantity', p_quantity, 'unitCost', p_unit_cost, 'totalCost', v_line_total, 'newQuantity', new_quantity)
  );

  delivery_id := v_delivery_id;
  delivery_reference := v_delivery_reference;
  return next;
end;
$$;

comment on function public.receive_inventory_stock_atomic(uuid, uuid, integer, numeric, text) is
  'Atomically receives stock from an active supplier in the manager store and records the delivery, movement, and audit event.';
