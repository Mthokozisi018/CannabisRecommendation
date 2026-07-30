alter table public.products
  add column if not exists is_visible_on_pos boolean not null default true;

update public.products
set is_visible_on_pos = true
where is_visible_on_pos is null;

create index if not exists products_store_pos_visibility_idx
  on public.products(store_id, product_status, is_visible_on_pos)
  where deleted_at is null;

create or replace function public.complete_receptionist_sale(
  p_checkout_id uuid,
  p_staff_user_id uuid,
  p_items jsonb
)
returns table(sale_id uuid, subtotal numeric, total numeric, already_completed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  product_row record;
  stock_row record;
  sale_uuid uuid;
  staff_store_id uuid;
  existing_sale_store_id uuid;
  expected_price numeric(12,2);
  requested_quantity integer;
  line_total numeric(12,2);
  running_total numeric(12,2) := 0;
begin
  if p_checkout_id is null then
    raise exception 'Checkout id is required.';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty.';
  end if;

  select sp.store_id
  into staff_store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.user_id, sp.auth_user_id) = p_staff_user_id
    and sp.role in ('manager', 'receptionist')
    and sp.is_active = true
    and coalesce(sp.account_status, 'active') = 'active'
    and s.store_access_status = 'active'
  limit 1;

  if staff_store_id is null then
    raise exception 'Receptionist store assignment is required.';
  end if;

  select ps.id, ps.store_id, ps.subtotal, ps.total
  into sale_id, existing_sale_store_id, subtotal, total
  from public.pos_sales ps
  where ps.checkout_id = p_checkout_id;

  if sale_id is not null then
    if existing_sale_store_id <> staff_store_id then
      raise exception 'Checkout belongs to a different store.';
    end if;

    already_completed := true;
    return next;
    return;
  end if;

  create temporary table if not exists checkout_items (
    product_id uuid primary key,
    quantity integer not null,
    unit_price numeric(12,2) not null
  ) on commit drop;

  truncate table checkout_items;

  for item in select * from jsonb_array_elements(p_items)
  loop
    requested_quantity := (item->>'quantity')::integer;
    expected_price := (item->>'unitPrice')::numeric(12,2);

    if requested_quantity is null or requested_quantity <= 0 then
      raise exception 'Invalid cart quantity.';
    end if;

    if expected_price is null or expected_price < 0 then
      raise exception 'Invalid cart price.';
    end if;

    insert into checkout_items(product_id, quantity, unit_price)
    values ((item->>'productId')::uuid, requested_quantity, expected_price)
    on conflict (product_id) do update
    set quantity = checkout_items.quantity + excluded.quantity,
        unit_price = excluded.unit_price;
  end loop;

  insert into public.pos_sales(checkout_id, store_id, staff_user_id, subtotal, total)
  values (p_checkout_id, staff_store_id, p_staff_user_id, 0, 0)
  returning id into sale_uuid;

  for item in select to_jsonb(ci) from checkout_items ci
  loop
    requested_quantity := (item->>'quantity')::integer;
    expected_price := (item->>'unit_price')::numeric(12,2);

    select p.id, p.product_name, p.category, p.subcategory, p.price, p.product_status, p.is_visible_on_pos, p.deleted_at
    into product_row
    from public.products p
    where p.id = (item->>'product_id')::uuid
      and p.store_id = staff_store_id
    for update;

    if product_row.id is null or product_row.deleted_at is not null or product_row.product_status <> 'active' or product_row.is_visible_on_pos is false then
      raise exception 'Product is no longer available in this store.';
    end if;

    if product_row.price is null or product_row.price::numeric(12,2) <> expected_price then
      raise exception 'Product price changed. Please review the cart before checkout.';
    end if;

    select s.id, s.current_quantity
    into stock_row
    from public.inventory_stock s
    where s.product_id = product_row.id
      and s.store_id = staff_store_id
    for update;

    if stock_row.id is null then
      raise exception 'Product stock is unavailable.';
    end if;

    if stock_row.current_quantity < requested_quantity then
      raise exception 'Stock changed. Please review the cart before checkout.';
    end if;

    line_total := expected_price * requested_quantity;
    running_total := running_total + line_total;

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
      sale_uuid,
      product_row.id,
      coalesce(product_row.product_name, 'Product'),
      product_row.category,
      product_row.subcategory,
      expected_price,
      requested_quantity,
      line_total
    );

    update public.inventory_stock
    set current_quantity = current_quantity - requested_quantity,
        last_updated_by = p_staff_user_id
    where id = stock_row.id
      and store_id = staff_store_id;

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
      staff_store_id,
      product_row.id,
      'stock_removed',
      requested_quantity * -1,
      stock_row.current_quantity,
      stock_row.current_quantity - requested_quantity,
      'POS checkout sale',
      p_staff_user_id
    );
  end loop;

  update public.pos_sales
  set subtotal = running_total,
      total = running_total
  where id = sale_uuid
    and store_id = staff_store_id;

  insert into public.audit_logs(user_id, action, table_name, record_id, details)
  values (p_staff_user_id, 'receptionist_completed_pos_sale', 'pos_sales', sale_uuid, jsonb_build_object('checkoutId', p_checkout_id, 'storeId', staff_store_id, 'total', running_total));

  sale_id := sale_uuid;
  subtotal := running_total;
  total := running_total;
  already_completed := false;
  return next;
end;
$$;

grant execute on function public.complete_receptionist_sale(uuid, uuid, jsonb) to authenticated, service_role;
