create extension if not exists pgcrypto;

create table if not exists public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  checkout_id uuid not null unique,
  staff_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'completed' check (status in ('completed','voided')),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  total numeric(12,2) not null check (total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.pos_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.pos_sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name_snapshot text not null,
  category_snapshot text,
  subcategory_snapshot text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

alter table public.pos_sales enable row level security;
alter table public.pos_sale_items enable row level security;

drop policy if exists pos_sales_staff_select on public.pos_sales;
create policy pos_sales_staff_select
on public.pos_sales
for select
using (public.is_greenchoice_staff());

drop policy if exists pos_sale_items_staff_select on public.pos_sale_items;
create policy pos_sale_items_staff_select
on public.pos_sale_items
for select
using (public.is_greenchoice_staff());

grant select on table public.pos_sales, public.pos_sale_items to authenticated;
grant all privileges on table public.pos_sales, public.pos_sale_items to service_role;

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
  expected_price numeric(12,2);
  requested_quantity integer;
  line_total numeric(12,2);
  running_total numeric(12,2) := 0;
  default_store uuid := '00000000-0000-4000-8000-000000000001';
begin
  if p_checkout_id is null then
    raise exception 'Checkout id is required.';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty.';
  end if;

  if not exists (
    select 1
    from public.staff_profiles sp
    where coalesce(sp.user_id, sp.auth_user_id) = p_staff_user_id
      and sp.role in ('manager', 'receptionist')
      and sp.is_active = true
      and coalesce(sp.account_status, 'active') = 'active'
  ) then
    raise exception 'Receptionist authentication required.';
  end if;

  select ps.id, ps.subtotal, ps.total
  into sale_id, subtotal, total
  from public.pos_sales ps
  where ps.checkout_id = p_checkout_id;

  if sale_id is not null then
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
  values (p_checkout_id, default_store, p_staff_user_id, 0, 0)
  returning id into sale_uuid;

  for item in select to_jsonb(ci) from checkout_items ci
  loop
    requested_quantity := (item->>'quantity')::integer;
    expected_price := (item->>'unit_price')::numeric(12,2);

    select p.id, p.product_name, p.category, p.subcategory, p.price, p.product_status, p.deleted_at
    into product_row
    from public.products p
    where p.id = (item->>'product_id')::uuid
    for update;

    if product_row.id is null or product_row.deleted_at is not null or product_row.product_status <> 'active' then
      raise exception 'Product is no longer available.';
    end if;

    if product_row.price is null or product_row.price::numeric(12,2) <> expected_price then
      raise exception 'Product price changed. Please review the cart before checkout.';
    end if;

    select s.id, s.current_quantity
    into stock_row
    from public.inventory_stock s
    where s.product_id = product_row.id
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
    where id = stock_row.id;

    insert into public.inventory_movements(
      product_id,
      movement_type,
      quantity_changed,
      previous_quantity,
      new_quantity,
      reason,
      created_by
    )
    values (
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
  where id = sale_uuid;

  insert into public.audit_logs(user_id, action, table_name, record_id, details)
  values (p_staff_user_id, 'receptionist_completed_pos_sale', 'pos_sales', sale_uuid, jsonb_build_object('checkoutId', p_checkout_id, 'total', running_total));

  sale_id := sale_uuid;
  subtotal := running_total;
  total := running_total;
  already_completed := false;
  return next;
end;
$$;

grant execute on function public.complete_receptionist_sale(uuid, uuid, jsonb) to authenticated, service_role;
