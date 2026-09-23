-- Customer collection orders, inventory reservations, and atomic staff actions.

create sequence if not exists public.customer_order_number_seq
  as bigint
  minvalue 1000
  start with 1054;

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add column if not exists order_number text,
  add column if not exists customer_id uuid references public.customer_profiles(user_id) on delete restrict,
  add column if not exists payment_method text,
  add column if not exists payment_status text,
  add column if not exists subtotal numeric(12,2),
  add column if not exists total numeric(12,2),
  add column if not exists completed_at timestamptz,
  add column if not exists forfeited_at timestamptz,
  add column if not exists completed_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists forfeited_by_user_id uuid references auth.users(id) on delete set null;

alter table public.orders
  add constraint orders_status_check
    check (status in ('draft','confirmed','pending','cancelled','completed','forfeited')),
  add constraint orders_payment_method_check
    check (payment_method is null or payment_method in ('card','cash')),
  add constraint orders_payment_status_check
    check (payment_status is null or payment_status in ('awaiting_payment','paid','failed','refunded')),
  add constraint orders_subtotal_check
    check (subtotal is null or subtotal >= 0),
  add constraint orders_total_check
    check (total is null or total >= 0);

create unique index if not exists orders_order_number_uidx
  on public.orders(order_number)
  where order_number is not null;
create index if not exists orders_store_pending_created_idx
  on public.orders(store_id, created_at desc)
  where status = 'pending';
create index if not exists orders_customer_created_idx
  on public.orders(customer_id, created_at desc)
  where customer_id is not null;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name_snapshot text not null,
  category_snapshot text,
  subcategory_snapshot text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  unique(order_id, product_id)
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);

alter table public.inventory_stock
  add column if not exists reserved_quantity numeric(12,2) not null default 0;

alter table public.inventory_stock
  add constraint inventory_stock_reserved_quantity_check
    check (reserved_quantity >= 0 and reserved_quantity = trunc(reserved_quantity));

alter table public.inventory_movements
  drop constraint if exists inventory_movements_movement_type_check;

alter table public.inventory_movements
  add constraint inventory_movements_movement_type_check check (
    movement_type in (
      'initial_stock','stock_added','stock_removed','manual_adjustment','correction',
      'order_reserved','order_completed','order_released'
    )
  ),
  add column if not exists order_id uuid references public.orders(id) on delete set null,
  add column if not exists reservation_quantity_changed numeric(12,2) not null default 0,
  add column if not exists previous_reserved_quantity numeric(12,2),
  add column if not exists new_reserved_quantity numeric(12,2);

alter table public.pos_sales
  add column if not exists sale_source text not null default 'pos',
  add column if not exists online_order_id uuid references public.orders(id) on delete restrict;

alter table public.pos_sales
  add constraint pos_sales_sale_source_check check (sale_source in ('pos','online_order'));

create unique index if not exists pos_sales_online_order_uidx
  on public.pos_sales(online_order_id)
  where online_order_id is not null;

alter table public.order_events
  drop constraint if exists order_events_event_type_check;
alter table public.order_events
  add constraint order_events_event_type_check
    check (event_type in ('created','confirmed','cancelled','completed','forfeited'));

alter table public.order_items enable row level security;

drop policy if exists orders_member_read on public.orders;
drop policy if exists orders_member_insert on public.orders;
drop policy if exists orders_admin_update on public.orders;
drop policy if exists orders_customer_read on public.orders;
drop policy if exists orders_staff_store_read on public.orders;

create policy orders_customer_read
on public.orders for select to authenticated
using (customer_id = (select auth.uid()) and private.is_active_customer());

create policy orders_staff_store_read
on public.orders for select to authenticated
using (public.is_store_member(store_id));

drop policy if exists order_items_customer_read on public.order_items;
drop policy if exists order_items_staff_store_read on public.order_items;

create policy order_items_customer_read
on public.order_items for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.customer_id = (select auth.uid())
      and private.is_active_customer()
  )
);

create policy order_items_staff_store_read
on public.order_items for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and public.is_store_member(o.store_id)
  )
);

revoke all on table public.orders, public.order_items from anon, authenticated;
grant select on table public.orders, public.order_items to authenticated;
grant all privileges on table public.orders, public.order_items to service_role;
grant usage, select on sequence public.customer_order_number_seq to service_role;

create or replace function public.place_customer_collection_order(
  p_cart_id uuid,
  p_customer_user_id uuid,
  p_payment_method text
)
returns table(order_id uuid, order_number text, order_total numeric)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cart public.carts%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_total numeric(12,2) := 0;
  v_item record;
  v_product record;
  v_stock record;
begin
  if p_cart_id is null or p_customer_user_id is null or p_payment_method not in ('card','cash') then
    raise exception using errcode = '22023', message = 'Order request is invalid.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_cart_id::text, 0));

  if not exists (
    select 1 from public.customer_profiles cp
    where cp.user_id = p_customer_user_id and cp.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Customer account is not active.';
  end if;

  select c.* into v_cart
  from public.carts c
  join public.stores s on s.id = c.store_id
  where c.id = p_cart_id
    and c.created_by_user_id = p_customer_user_id
    and c.status = 'draft'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  for update of c;

  if not found then
    raise exception using errcode = '23514', message = 'Cart is not available for checkout.';
  end if;

  if not exists (select 1 from public.cart_items ci where ci.cart_id = v_cart.id) then
    raise exception using errcode = '22023', message = 'Cart is empty.';
  end if;

  v_order_number := 'GC-' || lpad(nextval('public.customer_order_number_seq')::text, 6, '0');
  insert into public.orders(
    store_id, cart_id, created_by_user_id, customer_id, order_number,
    status, payment_method, payment_status, total_cents, subtotal, total
  ) values (
    v_cart.store_id, v_cart.id, p_customer_user_id, p_customer_user_id, v_order_number,
    'pending', p_payment_method, 'awaiting_payment', 0, 0, 0
  ) returning id into v_order_id;

  for v_item in
    select ci.product_id, sum(ci.quantity)::integer as quantity, max(ci.unit_price_cents)::integer as unit_price_cents
    from public.cart_items ci
    where ci.cart_id = v_cart.id
    group by ci.product_id
    order by ci.product_id
  loop
    select p.id, p.store_id, p.product_name, p.category, p.subcategory, p.price,
           p.product_status, p.is_visible_on_pos, p.is_published, p.deleted_at
    into v_product
    from public.products p
    where p.id = v_item.product_id
    for update;

    if v_product.id is null or v_product.deleted_at is not null or
       v_product.product_status <> 'active' or v_product.is_visible_on_pos is false or
       v_product.is_published is false or v_product.price is null then
      raise exception using errcode = '23514', message = 'A product is no longer available.';
    end if;

    select s.id, s.current_quantity, s.reserved_quantity into v_stock
    from public.inventory_stock s
    where s.product_id = v_product.id and s.store_id = v_cart.store_id
    for update;

    if v_stock.id is null or v_stock.current_quantity < v_item.quantity then
      raise exception using errcode = '23514', message = 'Insufficient stock.';
    end if;
    if round(v_product.price * 100)::integer <> v_item.unit_price_cents then
      raise exception using errcode = '23514', message = 'Product price changed.';
    end if;

    insert into public.order_items(
      order_id, product_id, product_name_snapshot, category_snapshot,
      subcategory_snapshot, unit_price, quantity, line_total
    ) values (
      v_order_id, v_product.id, coalesce(v_product.product_name, 'Product'),
      v_product.category, v_product.subcategory, v_product.price,
      v_item.quantity, v_product.price * v_item.quantity
    );

    update public.inventory_stock
    set current_quantity = current_quantity - v_item.quantity,
        reserved_quantity = reserved_quantity + v_item.quantity,
        last_updated_by = p_customer_user_id
    where id = v_stock.id and current_quantity >= v_item.quantity;
    if not found then
      raise exception using errcode = '40001', message = 'Stock changed during checkout.';
    end if;

    insert into public.inventory_movements(
      store_id, product_id, order_id, movement_type, quantity_changed,
      previous_quantity, new_quantity, reservation_quantity_changed,
      previous_reserved_quantity, new_reserved_quantity, reason, created_by
    ) values (
      v_cart.store_id, v_product.id, v_order_id, 'order_reserved', -v_item.quantity,
      v_stock.current_quantity, v_stock.current_quantity - v_item.quantity, v_item.quantity,
      v_stock.reserved_quantity, v_stock.reserved_quantity + v_item.quantity,
      'Customer collection order reserved', p_customer_user_id
    );

    v_total := v_total + (v_product.price * v_item.quantity);
  end loop;

  update public.orders
  set subtotal = v_total, total = v_total, total_cents = round(v_total * 100)::integer, updated_at = now()
  where id = v_order_id;

  update public.carts set status = 'saved', updated_at = now() where id = v_cart.id;

  insert into public.order_events(order_id, store_id, actor_user_id, event_type)
  values (v_order_id, v_cart.store_id, p_customer_user_id, 'created');

  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (
    p_customer_user_id, 'customer_collection_order_placed', 'orders', v_order_id,
    v_cart.store_id, 'success', jsonb_build_object('orderNumber', v_order_number, 'total', v_total)
  );

  order_id := v_order_id;
  order_number := v_order_number;
  order_total := v_total;
  return next;
end;
$$;

create or replace function public.confirm_customer_collection_order(
  p_order_id uuid,
  p_actor_user_id uuid
)
returns table(sale_id uuid, order_number text, already_processed boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.orders%rowtype;
  v_actor_store_id uuid;
  v_sale_id uuid;
  v_item record;
  v_stock record;
begin
  select sp.store_id into v_actor_store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.auth_user_id, sp.user_id) = p_actor_user_id
    and sp.role = 'manager'
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  limit 1;

  if v_actor_store_id is null then
    raise exception using errcode = '42501', message = 'Manager access denied.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.store_id <> v_actor_store_id then
    raise exception using errcode = '42501', message = 'Order access denied.';
  end if;
  if v_order.status <> 'pending' then
    raise exception using errcode = '23514', message = 'Order is no longer pending.';
  end if;

  insert into public.pos_sales(
    store_id, checkout_id, staff_user_id, status, subtotal, total, sale_source, online_order_id
  ) values (
    v_order.store_id, v_order.id, p_actor_user_id, 'completed', v_order.subtotal, v_order.total,
    'online_order', v_order.id
  ) returning id into v_sale_id;

  for v_item in select * from public.order_items oi where oi.order_id = v_order.id order by oi.product_id
  loop
    select s.* into v_stock from public.inventory_stock s
    where s.store_id = v_order.store_id and s.product_id = v_item.product_id
    for update;

    if not found or v_stock.reserved_quantity < v_item.quantity then
      raise exception using errcode = '23514', message = 'Reserved inventory is unavailable.';
    end if;

    insert into public.pos_sale_items(
      sale_id, product_id, product_name_snapshot, category_snapshot,
      subcategory_snapshot, unit_price, quantity, line_total
    ) values (
      v_sale_id, v_item.product_id, v_item.product_name_snapshot, v_item.category_snapshot,
      v_item.subcategory_snapshot, v_item.unit_price, v_item.quantity, v_item.line_total
    );

    update public.inventory_stock
    set reserved_quantity = reserved_quantity - v_item.quantity,
        last_updated_by = p_actor_user_id
    where id = v_stock.id and reserved_quantity >= v_item.quantity;
    if not found then
      raise exception using errcode = '40001', message = 'Reservation changed during confirmation.';
    end if;

    insert into public.inventory_movements(
      store_id, product_id, order_id, movement_type, quantity_changed,
      previous_quantity, new_quantity, reservation_quantity_changed,
      previous_reserved_quantity, new_reserved_quantity, reason, created_by
    ) values (
      v_order.store_id, v_item.product_id, v_order.id, 'order_completed', 0,
      v_stock.current_quantity, v_stock.current_quantity, -v_item.quantity,
      v_stock.reserved_quantity, v_stock.reserved_quantity - v_item.quantity,
      'Customer collection order completed', p_actor_user_id
    );
  end loop;

  update public.orders
  set status = 'completed', payment_status = 'paid', completed_at = now(),
      completed_by_user_id = p_actor_user_id, updated_at = now()
  where id = v_order.id and status = 'pending';
  if not found then
    raise exception using errcode = '40001', message = 'Order changed during confirmation.';
  end if;

  insert into public.order_events(order_id, store_id, actor_user_id, event_type)
  values (v_order.id, v_order.store_id, p_actor_user_id, 'completed');
  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (
    p_actor_user_id, 'manager_confirmed_customer_order', 'orders', v_order.id,
    v_order.store_id, 'success', jsonb_build_object('orderNumber', v_order.order_number, 'saleId', v_sale_id)
  );

  sale_id := v_sale_id;
  order_number := v_order.order_number;
  already_processed := false;
  return next;
end;
$$;

create or replace function public.forfeit_customer_collection_order(
  p_order_id uuid,
  p_actor_user_id uuid
)
returns table(order_number text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.orders%rowtype;
  v_actor_store_id uuid;
  v_item record;
  v_stock record;
begin
  select sp.store_id into v_actor_store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.auth_user_id, sp.user_id) = p_actor_user_id
    and sp.role = 'manager'
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  limit 1;

  if v_actor_store_id is null then
    raise exception using errcode = '42501', message = 'Manager access denied.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.store_id <> v_actor_store_id then
    raise exception using errcode = '42501', message = 'Order access denied.';
  end if;
  if v_order.status <> 'pending' then
    raise exception using errcode = '23514', message = 'Order is no longer pending.';
  end if;

  for v_item in select * from public.order_items oi where oi.order_id = v_order.id order by oi.product_id
  loop
    select s.* into v_stock from public.inventory_stock s
    where s.store_id = v_order.store_id and s.product_id = v_item.product_id
    for update;
    if not found or v_stock.reserved_quantity < v_item.quantity then
      raise exception using errcode = '23514', message = 'Reserved inventory is unavailable.';
    end if;

    update public.inventory_stock
    set current_quantity = current_quantity + v_item.quantity,
        reserved_quantity = reserved_quantity - v_item.quantity,
        last_updated_by = p_actor_user_id
    where id = v_stock.id and reserved_quantity >= v_item.quantity;
    if not found then
      raise exception using errcode = '40001', message = 'Reservation changed during forfeiture.';
    end if;

    insert into public.inventory_movements(
      store_id, product_id, order_id, movement_type, quantity_changed,
      previous_quantity, new_quantity, reservation_quantity_changed,
      previous_reserved_quantity, new_reserved_quantity, reason, created_by
    ) values (
      v_order.store_id, v_item.product_id, v_order.id, 'order_released', v_item.quantity,
      v_stock.current_quantity, v_stock.current_quantity + v_item.quantity, -v_item.quantity,
      v_stock.reserved_quantity, v_stock.reserved_quantity - v_item.quantity,
      'Forfeited customer order released', p_actor_user_id
    );
  end loop;

  update public.orders
  set status = 'forfeited', forfeited_at = now(), forfeited_by_user_id = p_actor_user_id, updated_at = now()
  where id = v_order.id and status = 'pending';
  if not found then
    raise exception using errcode = '40001', message = 'Order changed during forfeiture.';
  end if;

  insert into public.order_events(order_id, store_id, actor_user_id, event_type)
  values (v_order.id, v_order.store_id, p_actor_user_id, 'forfeited');
  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (
    p_actor_user_id, 'manager_forfeited_customer_order', 'orders', v_order.id,
    v_order.store_id, 'success', jsonb_build_object('orderNumber', v_order.order_number)
  );

  order_number := v_order.order_number;
  return next;
end;
$$;

revoke all on function public.place_customer_collection_order(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.confirm_customer_collection_order(uuid, uuid) from public, anon, authenticated;
revoke all on function public.forfeit_customer_collection_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.place_customer_collection_order(uuid, uuid, text) to service_role;
grant execute on function public.confirm_customer_collection_order(uuid, uuid) to service_role;
grant execute on function public.forfeit_customer_collection_order(uuid, uuid) to service_role;
alter function public.place_customer_collection_order(uuid, uuid, text) owner to postgres;
alter function public.confirm_customer_collection_order(uuid, uuid) owner to postgres;
alter function public.forfeit_customer_collection_order(uuid, uuid) owner to postgres;
