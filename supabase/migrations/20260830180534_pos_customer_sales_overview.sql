-- Local-only review migration for POS customer selection and manager sales overview.
-- Do not apply to production until reviewed and approved.

create extension if not exists pgcrypto;

create table if not exists public.pos_customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 80),
  surname text not null check (char_length(btrim(surname)) between 1 and 80),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 170),
  phone_normalized text not null check (phone_normalized ~ '^\+27[6-8][0-9]{8}$'),
  phone_digits text not null check (phone_digits ~ '^0[6-8][0-9]{8}$'),
  phone_display text not null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  deleted_at timestamptz,
  constraint pos_customers_store_phone_unique unique (store_id, phone_normalized)
);

create index if not exists pos_customers_store_name_idx
  on public.pos_customers(store_id, lower(first_name), lower(surname))
  where deleted_at is null;

create index if not exists pos_customers_store_phone_digits_idx
  on public.pos_customers(store_id, phone_digits)
  where deleted_at is null;

alter table public.pos_customers enable row level security;

drop policy if exists pos_customers_staff_store_read on public.pos_customers;
create policy pos_customers_staff_store_read
on public.pos_customers
for select
to authenticated
using (public.is_store_member(store_id));

revoke all on table public.pos_customers from anon, authenticated;
grant select on table public.pos_customers to authenticated;
grant all privileges on table public.pos_customers to service_role;

alter table public.pos_sales
  add column if not exists customer_id uuid references public.pos_customers(id) on delete set null;

create index if not exists pos_sales_store_created_at_idx
  on public.pos_sales(store_id, created_at desc);

create index if not exists pos_sales_store_customer_idx
  on public.pos_sales(store_id, customer_id)
  where customer_id is not null;

create or replace function public.complete_receptionist_sale_v2(
  p_checkout_id uuid,
  p_auth_user_id uuid,
  p_customer_id uuid,
  p_items jsonb
)
returns table(sale_id uuid, subtotal numeric, total numeric, already_completed boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  item jsonb;
  product_row record;
  stock_row record;
  sale_uuid uuid;
  staff_store_id uuid;
  existing_sale_store_id uuid;
  existing_sale_staff_id uuid;
  existing_sale_customer_id uuid;
  expected_price numeric(12,2);
  requested_quantity integer;
  line_total numeric(12,2);
  running_total numeric(12,2) := 0;
begin
  if p_checkout_id is null or p_auth_user_id is null or p_customer_id is null then
    raise exception using errcode = '22023', message = 'Checkout request is invalid.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_checkout_id::text, 0));

  if jsonb_typeof(p_items) is distinct from 'array' or
     jsonb_array_length(p_items) = 0 or
     jsonb_array_length(p_items) > 100 then
    raise exception using errcode = '22023', message = 'Cart is invalid.';
  end if;

  select sp.store_id
  into staff_store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.auth_user_id, sp.user_id) = p_auth_user_id
    and sp.role in ('manager', 'receptionist')
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  limit 1;

  if staff_store_id is null then
    raise exception using errcode = '42501', message = 'Checkout access denied.';
  end if;

  if not exists (
    select 1
    from public.pos_customers pc
    where pc.id = p_customer_id
      and pc.store_id = staff_store_id
      and pc.deleted_at is null
  ) then
    raise exception using errcode = '42501', message = 'Customer does not belong to this store.';
  end if;

  select ps.id, ps.store_id, ps.staff_user_id, ps.customer_id, ps.subtotal, ps.total
  into sale_id, existing_sale_store_id, existing_sale_staff_id, existing_sale_customer_id, subtotal, total
  from public.pos_sales ps
  where ps.checkout_id = p_checkout_id;

  if sale_id is not null then
    if existing_sale_store_id <> staff_store_id or
       existing_sale_staff_id <> p_auth_user_id or
       existing_sale_customer_id is distinct from p_customer_id then
      raise exception using errcode = '42501', message = 'Checkout access denied.';
    end if;
    already_completed := true;
    return next;
    return;
  end if;

  create temporary table if not exists gc_checkout_items (
    product_id uuid primary key,
    quantity integer not null,
    unit_price numeric(12,2) not null
  ) on commit drop;
  truncate table gc_checkout_items;

  for item in select * from jsonb_array_elements(p_items)
  loop
    begin
      requested_quantity := (item->>'quantity')::integer;
      expected_price := (item->>'unitPrice')::numeric(12,2);
    exception when others then
      raise exception using errcode = '22023', message = 'Cart is invalid.';
    end;

    if requested_quantity is null or requested_quantity <= 0 or
       expected_price is null or expected_price < 0 then
      raise exception using errcode = '22023', message = 'Cart is invalid.';
    end if;

    insert into gc_checkout_items(product_id, quantity, unit_price)
    values ((item->>'productId')::uuid, requested_quantity, expected_price)
    on conflict (product_id) do update
      set quantity = gc_checkout_items.quantity + excluded.quantity,
          unit_price = excluded.unit_price;
  end loop;

  insert into public.pos_sales(checkout_id, store_id, staff_user_id, customer_id, subtotal, total)
  values (p_checkout_id, staff_store_id, p_auth_user_id, p_customer_id, 0, 0)
  returning id into sale_uuid;

  for item in select to_jsonb(ci) from gc_checkout_items ci
  loop
    requested_quantity := (item->>'quantity')::integer;
    expected_price := (item->>'unit_price')::numeric(12,2);

    select p.id, p.product_name, p.category, p.subcategory, p.price,
           p.product_status, p.is_visible_on_pos, p.deleted_at
    into product_row
    from public.products p
    where p.id = (item->>'product_id')::uuid
      and p.store_id = staff_store_id
    for update;

    if product_row.id is null or product_row.deleted_at is not null or
       product_row.product_status <> 'active' or product_row.is_visible_on_pos is false then
      raise exception using errcode = '23514', message = 'Product is unavailable.';
    end if;

    if product_row.price is null or product_row.price::numeric(12,2) <> expected_price then
      raise exception using errcode = '23514', message = 'Product price changed.';
    end if;

    select s.id, s.current_quantity
    into stock_row
    from public.inventory_stock s
    where s.product_id = product_row.id
      and s.store_id = staff_store_id
    for update;

    if stock_row.id is null or stock_row.current_quantity < requested_quantity then
      raise exception using errcode = '23514', message = 'Insufficient stock.';
    end if;

    line_total := expected_price * requested_quantity;
    running_total := running_total + line_total;

    insert into public.pos_sale_items(
      sale_id, product_id, product_name_snapshot, category_snapshot,
      subcategory_snapshot, unit_price, quantity, line_total
    )
    values (
      sale_uuid, product_row.id, coalesce(product_row.product_name, 'Product'),
      product_row.category, product_row.subcategory, expected_price,
      requested_quantity, line_total
    );

    update public.inventory_stock
    set current_quantity = current_quantity - requested_quantity,
        last_updated_by = p_auth_user_id
    where id = stock_row.id
      and store_id = staff_store_id
      and current_quantity >= requested_quantity;

    if not found then
      raise exception using errcode = '40001', message = 'Stock changed.';
    end if;

    insert into public.inventory_movements(
      store_id, product_id, movement_type, quantity_changed,
      previous_quantity, new_quantity, reason, created_by
    )
    values (
      staff_store_id, product_row.id, 'stock_removed', -requested_quantity,
      stock_row.current_quantity, stock_row.current_quantity - requested_quantity,
      'POS checkout sale', p_auth_user_id
    );
  end loop;

  update public.pos_sales
  set subtotal = running_total, total = running_total
  where id = sale_uuid and store_id = staff_store_id;

  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (
    p_auth_user_id,
    'receptionist_completed_pos_sale',
    'pos_sales',
    sale_uuid,
    staff_store_id,
    'completed',
    jsonb_build_object('checkoutId', p_checkout_id, 'customerId', p_customer_id, 'total', running_total)
  );

  sale_id := sale_uuid;
  subtotal := running_total;
  total := running_total;
  already_completed := false;
  return next;
end;
$$;

revoke all on function public.complete_receptionist_sale_v2(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.complete_receptionist_sale_v2(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_receptionist_sale_v2(uuid, uuid, uuid, jsonb) to service_role;
alter function public.complete_receptionist_sale_v2(uuid, uuid, uuid, jsonb) owner to postgres;
