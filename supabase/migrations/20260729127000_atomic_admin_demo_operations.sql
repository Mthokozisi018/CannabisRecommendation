create or replace function public.add_admin_demo_inventory_stock(
  p_store_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_reason text default 'manual_adjustment'
)
returns table(
  stock_id uuid,
  previous_quantity integer,
  new_quantity integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_stock record;
begin
  if v_actor_id is null
    or not public.is_greenchoice_admin()
    or p_store_id is null
    or p_product_id is null
    or p_quantity is null
    or p_quantity <= 0
    or p_quantity > 1000000
  then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  if not exists (
    select 1
    from public.stores s
    where s.id = p_store_id
      and s.slug = 'greenchoice-admin-demo-store'
      and s.store_access_status = 'active'
      and s.is_active is not false
  ) or not exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.store_id = p_store_id
      and p.deleted_at is null
  ) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  select s.id, s.current_quantity
  into v_stock
  from public.inventory_stock s
  where s.product_id = p_product_id
    and s.store_id = p_store_id
  for update;

  if v_stock.id is null
    or v_stock.current_quantity is null
    or v_stock.current_quantity <> trunc(v_stock.current_quantity)
  then
    raise exception using errcode = '23514', message = 'invalid_inventory';
  end if;

  stock_id := v_stock.id;
  previous_quantity := v_stock.current_quantity::integer;
  new_quantity := previous_quantity + p_quantity;

  update public.inventory_stock
  set current_quantity = new_quantity,
      last_updated_by = v_actor_id
  where id = stock_id
    and store_id = p_store_id;

  insert into public.inventory_movements(
    store_id,
    product_id,
    movement_type,
    quantity_changed,
    previous_quantity,
    new_quantity,
    reason,
    created_by
  )
  values (
    p_store_id,
    p_product_id,
    'stock_added',
    p_quantity,
    previous_quantity,
    new_quantity,
    left(coalesce(nullif(btrim(p_reason), ''), 'manual_adjustment'), 240),
    v_actor_id
  );

  insert into public.audit_logs(
    user_id,
    action,
    table_name,
    record_id,
    store_id,
    result,
    details
  )
  values (
    v_actor_id,
    'admin_demo_added_inventory_stock',
    'inventory_stock',
    stock_id,
    p_store_id,
    'completed',
    jsonb_build_object(
      'productId', p_product_id,
      'previousQuantity', previous_quantity,
      'quantityChanged', p_quantity,
      'newQuantity', new_quantity,
      'demoStore', true
    )
  );

  return next;
end;
$$;

alter function public.add_admin_demo_inventory_stock(uuid, uuid, integer, text) owner to postgres;
revoke all on function public.add_admin_demo_inventory_stock(uuid, uuid, integer, text)
  from public, anon;
grant execute on function public.add_admin_demo_inventory_stock(uuid, uuid, integer, text)
  to authenticated;

create or replace function public.complete_admin_demo_sale(
  p_store_id uuid,
  p_checkout_id uuid,
  p_items jsonb
)
returns table(
  sale_id uuid,
  subtotal numeric,
  total numeric,
  already_completed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_item jsonb;
  v_product record;
  v_stock record;
  v_sale_id uuid;
  v_existing_store_id uuid;
  v_existing_actor_id uuid;
  v_expected_price numeric(12,2);
  v_requested_quantity integer;
  v_line_total numeric(12,2);
  v_running_total numeric(12,2) := 0;
begin
  if v_actor_id is null
    or not public.is_greenchoice_admin()
    or p_store_id is null
    or p_checkout_id is null
    or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 100
  then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  if not exists (
    select 1
    from public.stores s
    where s.id = p_store_id
      and s.slug = 'greenchoice-admin-demo-store'
      and s.store_access_status = 'active'
      and s.is_active is not false
  ) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_checkout_id::text, 0));

  select ps.id, ps.store_id, ps.staff_user_id, ps.subtotal, ps.total
  into sale_id, v_existing_store_id, v_existing_actor_id, subtotal, total
  from public.pos_sales ps
  where ps.checkout_id = p_checkout_id;

  if sale_id is not null then
    if v_existing_store_id <> p_store_id or v_existing_actor_id <> v_actor_id then
      raise exception using errcode = '42501', message = 'not_authorized';
    end if;
    already_completed := true;
    return next;
    return;
  end if;

  create temporary table if not exists gc_admin_demo_checkout_items (
    product_id uuid primary key,
    quantity integer not null,
    unit_price numeric(12,2) not null
  ) on commit drop;
  truncate table gc_admin_demo_checkout_items;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    begin
      v_requested_quantity := (v_item->>'quantity')::integer;
      v_expected_price := (v_item->>'unitPrice')::numeric(12,2);
    exception when others then
      raise exception using errcode = '22023', message = 'invalid_cart';
    end;

    if v_requested_quantity is null
      or v_requested_quantity <= 0
      or v_requested_quantity > 100000
      or v_expected_price is null
      or v_expected_price < 0
      or v_expected_price > 1000000
    then
      raise exception using errcode = '22023', message = 'invalid_cart';
    end if;

    begin
      insert into gc_admin_demo_checkout_items(product_id, quantity, unit_price)
      values ((v_item->>'productId')::uuid, v_requested_quantity, v_expected_price)
      on conflict (product_id) do update
        set quantity = gc_admin_demo_checkout_items.quantity + excluded.quantity,
            unit_price = excluded.unit_price;
    exception when others then
      raise exception using errcode = '22023', message = 'invalid_cart';
    end;
  end loop;

  insert into public.pos_sales(checkout_id, store_id, staff_user_id, subtotal, total)
  values (p_checkout_id, p_store_id, v_actor_id, 0, 0)
  returning id into v_sale_id;

  for v_item in
    select to_jsonb(ci)
    from gc_admin_demo_checkout_items ci
    order by ci.product_id
  loop
    v_requested_quantity := (v_item->>'quantity')::integer;
    v_expected_price := (v_item->>'unit_price')::numeric(12,2);

    select
      p.id,
      p.product_name,
      p.category,
      p.subcategory,
      p.price,
      p.product_status,
      p.is_visible_on_pos,
      p.deleted_at
    into v_product
    from public.products p
    where p.id = (v_item->>'product_id')::uuid
      and p.store_id = p_store_id
    for update;

    if v_product.id is null
      or v_product.deleted_at is not null
      or v_product.product_status <> 'active'
      or v_product.is_visible_on_pos is false
      or v_product.price is null
      or v_product.price::numeric(12,2) <> v_expected_price
    then
      raise exception using errcode = '23514', message = 'product_unavailable';
    end if;

    select s.id, s.current_quantity
    into v_stock
    from public.inventory_stock s
    where s.product_id = v_product.id
      and s.store_id = p_store_id
    for update;

    if v_stock.id is null
      or v_stock.current_quantity is null
      or v_stock.current_quantity <> trunc(v_stock.current_quantity)
      or v_stock.current_quantity < v_requested_quantity
    then
      raise exception using errcode = '23514', message = 'insufficient_stock';
    end if;

    v_line_total := v_expected_price * v_requested_quantity;
    v_running_total := v_running_total + v_line_total;

    insert into public.pos_sale_items(
      sale_id,
      product_id,
      product_name_snapshot,
      category_snapshot,
      subcategory_snapshot,
      unit_price,
      quantity,
      line_total
    )
    values (
      v_sale_id,
      v_product.id,
      coalesce(v_product.product_name, 'Product'),
      v_product.category,
      v_product.subcategory,
      v_expected_price,
      v_requested_quantity,
      v_line_total
    );

    update public.inventory_stock
    set current_quantity = current_quantity - v_requested_quantity,
        last_updated_by = v_actor_id
    where id = v_stock.id
      and store_id = p_store_id
      and current_quantity >= v_requested_quantity;

    if not found then
      raise exception using errcode = '40001', message = 'stock_changed';
    end if;

    insert into public.inventory_movements(
      store_id,
      product_id,
      movement_type,
      quantity_changed,
      previous_quantity,
      new_quantity,
      reason,
      created_by
    )
    values (
      p_store_id,
      v_product.id,
      'stock_removed',
      -v_requested_quantity,
      v_stock.current_quantity,
      v_stock.current_quantity - v_requested_quantity,
      'Admin demo POS checkout sale',
      v_actor_id
    );
  end loop;

  update public.pos_sales
  set subtotal = v_running_total,
      total = v_running_total
  where id = v_sale_id
    and store_id = p_store_id;

  insert into public.audit_logs(
    user_id,
    action,
    table_name,
    record_id,
    store_id,
    result,
    details
  )
  values (
    v_actor_id,
    'admin_demo_completed_pos_sale',
    'pos_sales',
    v_sale_id,
    p_store_id,
    'completed',
    jsonb_build_object(
      'checkoutId', p_checkout_id,
      'total', v_running_total,
      'demoStore', true
    )
  );

  sale_id := v_sale_id;
  subtotal := v_running_total;
  total := v_running_total;
  already_completed := false;
  return next;
end;
$$;

alter function public.complete_admin_demo_sale(uuid, uuid, jsonb) owner to postgres;
revoke all on function public.complete_admin_demo_sale(uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.complete_admin_demo_sale(uuid, uuid, jsonb)
  to authenticated;

comment on function public.complete_admin_demo_sale(uuid, uuid, jsonb) is
  'Atomically completes an administrator-authenticated sale for the dedicated GreenChoice demo store only.';
