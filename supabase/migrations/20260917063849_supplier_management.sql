create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  normalized_name text generated always as (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) stored,
  contact_person text check (contact_person is null or char_length(btrim(contact_person)) <= 160),
  phone text check (phone is null or char_length(btrim(phone)) <= 40),
  email text check (email is null or char_length(btrim(email)) <= 254),
  address text check (address is null or char_length(btrim(address)) <= 500),
  notes text check (notes is null or char_length(btrim(notes)) <= 2000),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, store_id),
  unique (store_id, normalized_name)
);

create table public.supplier_categories (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null,
  store_id uuid not null,
  category text not null check (category in ('Flower', 'Pre-Rolls', 'Edibles', 'Accessories', 'Vape Cartridges', 'Disposable Vapes', 'Concentrates', 'Beverages')),
  subcategory text not null check (char_length(btrim(subcategory)) between 1 and 120),
  created_at timestamptz not null default now(),
  foreign key (supplier_id, store_id) references public.suppliers(id, store_id) on delete cascade,
  unique (supplier_id, category, subcategory)
);

create table public.supply_deliveries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  supplier_id uuid not null,
  reference text not null,
  received_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id) on delete set null,
  total_cost numeric(14,2) not null check (total_cost >= 0),
  created_at timestamptz not null default now(),
  foreign key (supplier_id, store_id) references public.suppliers(id, store_id) on delete restrict,
  unique (id, store_id),
  unique (store_id, reference)
);

create table public.supply_delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null,
  store_id uuid not null,
  product_id uuid not null references public.products(id) on delete restrict,
  inventory_movement_id uuid not null unique references public.inventory_movements(id) on delete restrict,
  product_name_snapshot text not null,
  category_snapshot text not null,
  subcategory_snapshot text not null,
  cultivation_type_snapshot text,
  quantity numeric not null check (quantity > 0 and public.greenchoice_is_whole_number(quantity)),
  unit text not null check (unit in ('grams', 'units')),
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  foreign key (delivery_id, store_id) references public.supply_deliveries(id, store_id) on delete restrict
);

create index suppliers_store_status_idx on public.suppliers(store_id, status, name);
create index supplier_categories_store_lookup_idx on public.supplier_categories(store_id, category, subcategory, supplier_id);
create index supply_deliveries_store_received_idx on public.supply_deliveries(store_id, received_at desc);
create index supply_deliveries_supplier_received_idx on public.supply_deliveries(supplier_id, received_at desc);
create index supply_delivery_items_store_product_idx on public.supply_delivery_items(store_id, product_id);
create index supply_delivery_items_delivery_idx on public.supply_delivery_items(delivery_id);

create trigger suppliers_touch_updated_at
before update on public.suppliers
for each row execute function public.touch_updated_at();

alter table public.suppliers enable row level security;
alter table public.supplier_categories enable row level security;
alter table public.supply_deliveries enable row level security;
alter table public.supply_delivery_items enable row level security;

revoke all on table public.suppliers, public.supplier_categories, public.supply_deliveries, public.supply_delivery_items from anon, authenticated;
grant select on table public.suppliers, public.supplier_categories, public.supply_deliveries, public.supply_delivery_items to authenticated;

create policy suppliers_manager_select on public.suppliers
for select to authenticated
using (public.is_greenchoice_manager() and store_id = public.current_staff_store_id());

create policy supplier_categories_manager_select on public.supplier_categories
for select to authenticated
using (public.is_greenchoice_manager() and store_id = public.current_staff_store_id());

create policy supply_deliveries_manager_select on public.supply_deliveries
for select to authenticated
using (public.is_greenchoice_manager() and store_id = public.current_staff_store_id());

create policy supply_delivery_items_manager_select on public.supply_delivery_items
for select to authenticated
using (public.is_greenchoice_manager() and store_id = public.current_staff_store_id());

create or replace function public.save_supplier_atomic(
  p_supplier_id uuid,
  p_name text,
  p_contact_person text,
  p_phone text,
  p_email text,
  p_address text,
  p_notes text,
  p_status text,
  p_categories jsonb
)
returns table(supplier_id uuid, was_created boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_store_id uuid;
  v_supplier_id uuid;
  v_mapping jsonb;
  v_category text;
  v_subcategory text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  select public.current_staff_store_id() into v_store_id;
  if v_store_id is null or not public.is_greenchoice_manager() then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  if nullif(btrim(p_name), '') is null
    or char_length(btrim(p_name)) > 160
    or p_status not in ('active', 'inactive')
    or p_categories is null
    or jsonb_typeof(p_categories) <> 'array'
    or jsonb_array_length(p_categories) = 0
    or char_length(coalesce(btrim(p_contact_person), '')) > 160
    or char_length(coalesce(btrim(p_phone), '')) > 40
    or char_length(coalesce(btrim(p_email), '')) > 254
    or char_length(coalesce(btrim(p_address), '')) > 500
    or char_length(coalesce(btrim(p_notes), '')) > 2000
  then
    raise exception using errcode = '22023', message = 'invalid_supplier';
  end if;

  if nullif(btrim(coalesce(p_email, '')), '') is not null
    and btrim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception using errcode = '22023', message = 'invalid_supplier_email';
  end if;

  for v_mapping in select value from jsonb_array_elements(p_categories)
  loop
    v_category := nullif(btrim(v_mapping ->> 'category'), '');
    v_subcategory := nullif(btrim(v_mapping ->> 'subcategory'), '');
    if v_category is null or v_subcategory is null
      or not (
        (v_category in ('Flower', 'Pre-Rolls') and v_subcategory in ('Indoor', 'Greenhouse', 'Outdoor'))
        or (v_category = 'Edibles' and v_subcategory in ('Gummies', 'Chocolates', 'Cookies', 'Brownies', 'Drinks'))
        or (v_category = 'Accessories' and v_subcategory in ('Lighters', 'Rolling Papers', 'Grinders', 'Pipes', 'Storage Containers', 'Trays'))
        or (v_category = 'Vape Cartridges' and v_subcategory in ('Vape Cartridge', 'Disposable Vape'))
        or (v_category = 'Disposable Vapes' and v_subcategory in ('Sativa', 'Indica', 'Hybrid'))
        or (v_category = 'Concentrates' and v_subcategory = 'Dab')
        or (v_category = 'Beverages' and v_subcategory in ('Soft Drinks', 'Juices', 'Water', 'Energy Drinks'))
      )
    then
      raise exception using errcode = '22023', message = 'invalid_supplier_category';
    end if;
  end loop;

  if exists (
    select 1
    from public.suppliers s
    where s.store_id = v_store_id
      and s.normalized_name = lower(regexp_replace(btrim(p_name), '\s+', ' ', 'g'))
      and (p_supplier_id is null or s.id <> p_supplier_id)
  ) then
    raise exception using errcode = '23505', message = 'duplicate_supplier';
  end if;

  if p_supplier_id is null then
    insert into public.suppliers(store_id, name, contact_person, phone, email, address, notes, status, created_by, updated_by)
    values (
      v_store_id,
      btrim(p_name),
      nullif(btrim(p_contact_person), ''),
      nullif(btrim(p_phone), ''),
      nullif(lower(btrim(p_email)), ''),
      nullif(btrim(p_address), ''),
      nullif(btrim(p_notes), ''),
      p_status,
      v_user_id,
      v_user_id
    )
    returning id into v_supplier_id;
    was_created := true;
  else
    update public.suppliers s
    set name = btrim(p_name),
        contact_person = nullif(btrim(p_contact_person), ''),
        phone = nullif(btrim(p_phone), ''),
        email = nullif(lower(btrim(p_email)), ''),
        address = nullif(btrim(p_address), ''),
        notes = nullif(btrim(p_notes), ''),
        status = p_status,
        updated_by = v_user_id
    where s.id = p_supplier_id
      and s.store_id = v_store_id
    returning s.id into v_supplier_id;
    if v_supplier_id is null then
      raise exception using errcode = '42501', message = 'supplier_unavailable';
    end if;
    delete from public.supplier_categories sc
    where sc.supplier_id = v_supplier_id and sc.store_id = v_store_id;
    was_created := false;
  end if;

  insert into public.supplier_categories(supplier_id, store_id, category, subcategory)
  select v_supplier_id, v_store_id, x.category, x.subcategory
  from (
    select distinct btrim(value ->> 'category') as category, btrim(value ->> 'subcategory') as subcategory
    from jsonb_array_elements(p_categories)
  ) x;

  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (
    v_user_id,
    case when was_created then 'manager_registered_supplier' else 'manager_updated_supplier' end,
    'suppliers',
    v_supplier_id,
    v_store_id,
    'completed',
    jsonb_build_object('supplierName', btrim(p_name), 'categoryCount', jsonb_array_length(p_categories), 'status', p_status)
  );

  supplier_id := v_supplier_id;
  return next;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'duplicate_supplier_or_category';
end;
$$;

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
  v_supplier_subcategory text;
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

  v_supplier_subcategory := case
    when v_product.category in ('Flower', 'Pre-Rolls') then v_product.cultivation_type
    else v_product.subcategory
  end;
  if not exists (
    select 1
    from public.suppliers s
    join public.supplier_categories sc on sc.supplier_id = s.id and sc.store_id = s.store_id
    where s.id = p_supplier_id
      and s.store_id = v_store_id
      and s.status = 'active'
      and sc.category = v_product.category
      and sc.subcategory = v_supplier_subcategory
  ) then
    raise exception using errcode = '23514', message = 'supplier_not_authorized_for_product';
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

create or replace function public.create_product_with_supply_atomic(
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
  p_low_stock_threshold integer,
  p_supplier_id uuid,
  p_unit_cost numeric
)
returns table(product_id uuid, current_quantity integer, delivery_id uuid, delivery_reference text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_product_id uuid;
  v_stock record;
begin
  if p_initial_stock is null or p_initial_stock <= 0 then
    raise exception using errcode = '22023', message = 'invalid_supply_intake';
  end if;

  select created.product_id
  into v_product_id
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

  select received.new_quantity, received.delivery_id, received.delivery_reference
  into v_stock
  from public.receive_inventory_stock_atomic(v_product_id, p_supplier_id, p_initial_stock, p_unit_cost, 'initial_supplier_delivery') received;

  product_id := v_product_id;
  current_quantity := v_stock.new_quantity;
  delivery_id := v_stock.delivery_id;
  delivery_reference := v_stock.delivery_reference;
  return next;
end;
$$;

revoke all on function public.save_supplier_atomic(uuid, text, text, text, text, text, text, text, jsonb) from public, anon;
revoke all on function public.receive_inventory_stock_atomic(uuid, uuid, integer, numeric, text) from public, anon;
revoke all on function public.create_product_with_supply_atomic(uuid, text, text, text, text, numeric, text, integer, numeric, numeric, integer, integer, uuid, numeric) from public, anon;
grant execute on function public.save_supplier_atomic(uuid, text, text, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.receive_inventory_stock_atomic(uuid, uuid, integer, numeric, text) to authenticated;
grant execute on function public.create_product_with_supply_atomic(uuid, text, text, text, text, numeric, text, integer, numeric, numeric, integer, integer, uuid, numeric) to authenticated;

revoke execute on function public.add_inventory_stock_atomic(uuid, integer, text) from authenticated;

comment on function public.receive_inventory_stock_atomic(uuid, uuid, integer, numeric, text) is
  'Atomically validates a store supplier mapping, increases inventory, and records the delivery, line item, movement, and audit event.';
comment on function public.create_product_with_supply_atomic(uuid, text, text, text, text, numeric, text, integer, numeric, numeric, integer, integer, uuid, numeric) is
  'Atomically creates a product with zero stock, then receives its initial supplier stock with procurement history.';
