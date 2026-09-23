-- Ensure customer checkout validates cart items against the cart store's
-- inventory row instead of assuming product rows are store-owned.

create or replace function public.place_customer_order_v2(
  p_cart_id uuid,
  p_customer_user_id uuid,
  p_fulfillment_type text,
  p_customer_details jsonb,
  p_payment_method text,
  p_idempotency_key uuid
)
returns table(order_id uuid, order_number text, order_total numeric)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cart public.carts%rowtype;
  v_existing public.orders%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(12,2) := 0;
  v_fee numeric(12,2) := 0;
  v_minimum numeric(12,2) := 0;
  v_first_name text := nullif(btrim(p_customer_details->>'firstName'), '');
  v_surname text := nullif(btrim(p_customer_details->>'surname'), '');
  v_phone text := nullif(btrim(p_customer_details->>'phoneNumber'), '');
  v_store_name text;
  v_store_address text;
  v_orders_enabled boolean;
  v_collection_enabled boolean;
  v_delivery_enabled boolean;
  v_eta_min integer;
  v_eta_max integer;
  v_item record;
  v_product record;
  v_stock record;
begin
  if p_cart_id is null or p_customer_user_id is null or p_idempotency_key is null
     or p_fulfillment_type not in ('collection','delivery')
     or p_payment_method not in ('card','cash','online')
     or jsonb_typeof(p_customer_details) <> 'object' then
    raise exception using errcode = '22023', message = 'Order request is invalid.';
  end if;
  if v_first_name is null or char_length(v_first_name) > 80
     or v_surname is null or char_length(v_surname) > 80
     or v_phone is null or v_phone !~ '^\+27[0-9]{9}$' then
    raise exception using errcode = '22023', message = 'Customer details are invalid.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_customer_user_id::text || ':' || p_idempotency_key::text, 0));
  select * into v_existing from public.orders
  where customer_id = p_customer_user_id and idempotency_key = p_idempotency_key;
  if found then
    order_id := v_existing.id;
    order_number := v_existing.order_number;
    order_total := v_existing.total;
    return next;
    return;
  end if;

  if not exists (select 1 from public.customer_profiles where user_id = p_customer_user_id and status = 'active') then
    raise exception using errcode = '42501', message = 'Customer account is not active.';
  end if;

  select c.* into v_cart
  from public.carts c
  join public.stores s on s.id = c.store_id
  where c.id = p_cart_id and c.created_by_user_id = p_customer_user_id and c.status = 'draft'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  for update of c;
  if not found then raise exception using errcode = '23514', message = 'Cart is not available for checkout.'; end if;
  if not exists (select 1 from public.cart_items where cart_id = v_cart.id) then
    raise exception using errcode = '22023', message = 'Cart is empty.';
  end if;

  select s.name,
    nullif(concat_ws(', ', coalesce(s.physical_store_address, s.store_address, s.address), s.city, s.province, s.postal_code), ''),
    coalesce(fs.orders_enabled, true), coalesce(fs.collection_enabled, true), coalesce(fs.delivery_enabled, false),
    case when p_fulfillment_type = 'delivery' then coalesce(fs.delivery_fee, 0) else coalesce(fs.collection_fee, 0) end,
    case when p_fulfillment_type = 'delivery' then coalesce(fs.delivery_minimum, 0) else coalesce(fs.collection_minimum, 0) end,
    fs.delivery_eta_min_minutes, fs.delivery_eta_max_minutes
  into v_store_name, v_store_address, v_orders_enabled, v_collection_enabled, v_delivery_enabled, v_fee, v_minimum, v_eta_min, v_eta_max
  from public.stores s left join public.store_fulfillment_settings fs on fs.store_id = s.id
  where s.id = v_cart.store_id;

  if not v_orders_enabled then
    raise exception using errcode = '23514', message = 'Online ordering is not enabled for this store.';
  end if;
  if p_fulfillment_type = 'collection' and not v_collection_enabled then
    raise exception using errcode = '23514', message = 'Collection is not enabled for this store.';
  end if;
  if p_fulfillment_type = 'delivery' and not v_delivery_enabled then
    raise exception using errcode = '23514', message = 'Delivery is not enabled for this store.';
  end if;
  if p_fulfillment_type = 'delivery' and (
    nullif(btrim(p_customer_details->>'addressLine'), '') is null or
    nullif(btrim(p_customer_details->>'suburb'), '') is null or
    nullif(btrim(p_customer_details->>'city'), '') is null or
    nullif(btrim(p_customer_details->>'province'), '') is null or
    coalesce(p_customer_details->>'postalCode', '') !~ '^[0-9]{4}$'
  ) then raise exception using errcode = '22023', message = 'Delivery address is incomplete.'; end if;

  v_order_number := 'GC-' || to_char(clock_timestamp() at time zone 'Africa/Johannesburg', 'YYMMDD')
    || '-' || lpad(nextval('public.customer_order_number_seq')::text, 6, '0');
  insert into public.orders(
    store_id, cart_id, created_by_user_id, customer_id, order_number, status,
    payment_method, payment_status, total_cents, subtotal, fulfillment_fee, total,
    fulfillment_type, customer_first_name_snapshot, customer_surname_snapshot,
    customer_phone_snapshot, idempotency_key, placed_at, collection_expires_at
  ) values (
    v_cart.store_id, v_cart.id, p_customer_user_id, p_customer_user_id, v_order_number, 'pending',
    p_payment_method, 'awaiting_payment', 0, 0, v_fee, 0,
    p_fulfillment_type, v_first_name, v_surname, v_phone, p_idempotency_key, now(),
    case when p_fulfillment_type = 'collection' then now() + interval '4 days' end
  ) returning id into v_order_id;

  for v_item in
    select ci.product_id, sum(ci.quantity)::integer as quantity, max(ci.unit_price_cents)::integer as unit_price_cents
    from public.cart_items ci
    where ci.cart_id = v_cart.id
    group by ci.product_id
    order by ci.product_id
  loop
    select p.id, p.product_name, p.category, p.subcategory, p.price, p.image_url, p.image_path,
      p.product_status, p.is_visible_on_pos, p.is_published, p.deleted_at
    into v_product from public.products p
    where p.id = v_item.product_id for update;
    if v_product.id is null or v_product.deleted_at is not null or v_product.product_status <> 'active'
       or v_product.is_visible_on_pos is false or v_product.is_published is false or v_product.price is null then
      raise exception using errcode = '23514', message = 'A product is no longer available.';
    end if;

    select s.* into v_stock from public.inventory_stock s
    where s.product_id = v_product.id and s.store_id = v_cart.store_id for update;
    if not found or v_stock.current_quantity < v_item.quantity then
      raise exception using errcode = '23514', message = 'Insufficient stock.';
    end if;
    if round(v_product.price * 100)::integer <> v_item.unit_price_cents then
      raise exception using errcode = '23514', message = 'Product price changed.';
    end if;

    insert into public.order_items(order_id, product_id, product_name_snapshot, category_snapshot,
      subcategory_snapshot, image_url_snapshot, unit_price, quantity, line_total)
    values (v_order_id, v_product.id, coalesce(v_product.product_name, 'Product'), v_product.category,
      v_product.subcategory, coalesce(v_product.image_url, v_product.image_path), v_product.price,
      v_item.quantity, v_product.price * v_item.quantity);

    update public.inventory_stock set current_quantity = current_quantity - v_item.quantity,
      reserved_quantity = reserved_quantity + v_item.quantity, last_updated_by = p_customer_user_id
    where id = v_stock.id and current_quantity >= v_item.quantity;
    if not found then raise exception using errcode = '40001', message = 'Stock changed during checkout.'; end if;

    insert into public.inventory_movements(store_id, product_id, order_id, movement_type, quantity_changed,
      previous_quantity, new_quantity, reservation_quantity_changed, previous_reserved_quantity,
      new_reserved_quantity, reason, created_by)
    values (v_cart.store_id, v_product.id, v_order_id, 'order_reserved', -v_item.quantity,
      v_stock.current_quantity, v_stock.current_quantity - v_item.quantity, v_item.quantity,
      v_stock.reserved_quantity, v_stock.reserved_quantity + v_item.quantity,
      'Customer order reserved', p_customer_user_id);
    v_subtotal := v_subtotal + (v_product.price * v_item.quantity);
  end loop;

  if v_subtotal < v_minimum then
    raise exception using errcode = '23514', message = 'Order does not meet the store minimum.';
  end if;
  update public.orders set subtotal = v_subtotal, total = v_subtotal + v_fee,
    total_cents = round((v_subtotal + v_fee) * 100)::integer, updated_at = now()
  where id = v_order_id;

  insert into public.order_fulfillment_details(order_id, fulfillment_type, store_name_snapshot,
    store_address_snapshot, recipient_first_name, recipient_surname, recipient_phone,
    address_line, suburb, city, province, postal_code, delivery_instructions,
    delivery_eta_min_minutes, delivery_eta_max_minutes)
  values (v_order_id, p_fulfillment_type, v_store_name, v_store_address, v_first_name, v_surname, v_phone,
    case when p_fulfillment_type = 'delivery' then nullif(btrim(p_customer_details->>'addressLine'), '') end,
    case when p_fulfillment_type = 'delivery' then nullif(btrim(p_customer_details->>'suburb'), '') end,
    case when p_fulfillment_type = 'delivery' then nullif(btrim(p_customer_details->>'city'), '') end,
    case when p_fulfillment_type = 'delivery' then nullif(btrim(p_customer_details->>'province'), '') end,
    case when p_fulfillment_type = 'delivery' then p_customer_details->>'postalCode' end,
    case when p_fulfillment_type = 'delivery' then nullif(btrim(p_customer_details->>'deliveryInstructions'), '') end,
    case when p_fulfillment_type = 'delivery' then v_eta_min end,
    case when p_fulfillment_type = 'delivery' then v_eta_max end);

  update public.carts set status = 'saved', updated_at = now() where id = v_cart.id;
  insert into public.order_events(order_id, store_id, actor_user_id, event_type)
  values (v_order_id, v_cart.store_id, p_customer_user_id, 'created'),
         (v_order_id, v_cart.store_id, p_customer_user_id, 'placed');
  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (p_customer_user_id, 'customer_order_placed', 'orders', v_order_id, v_cart.store_id,
    'success', jsonb_build_object('orderNumber', v_order_number, 'fulfillmentType', p_fulfillment_type,
      'subtotal', v_subtotal, 'fee', v_fee, 'total', v_subtotal + v_fee));
  order_id := v_order_id; order_number := v_order_number; order_total := v_subtotal + v_fee;
  return next;
end;
$$;

alter function public.place_customer_order_v2(uuid, uuid, text, jsonb, text, uuid) owner to postgres;
revoke all on function public.place_customer_order_v2(uuid, uuid, text, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.place_customer_order_v2(uuid, uuid, text, jsonb, text, uuid) to service_role;
