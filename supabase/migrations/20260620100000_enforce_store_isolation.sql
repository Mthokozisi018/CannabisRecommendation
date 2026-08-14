alter table public.inventory_stock
  add column if not exists store_id uuid references public.stores(id) on delete cascade;

alter table public.inventory_movements
  add column if not exists store_id uuid references public.stores(id) on delete cascade;

update public.inventory_stock s
set store_id = p.store_id
from public.products p
where s.product_id = p.id
  and s.store_id is null;

update public.inventory_movements m
set store_id = p.store_id
from public.products p
where m.product_id = p.id
  and m.store_id is null;

alter table public.inventory_stock
  alter column store_id set not null;

alter table public.inventory_movements
  alter column store_id set not null;

create index if not exists inventory_stock_store_product_idx on public.inventory_stock(store_id, product_id);
create index if not exists inventory_movements_store_product_idx on public.inventory_movements(store_id, product_id);
create index if not exists pos_sales_store_created_idx on public.pos_sales(store_id, created_at desc);

create or replace function public.set_inventory_row_store_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  product_store_id uuid;
begin
  select p.store_id
  into product_store_id
  from public.products p
  where p.id = new.product_id;

  if product_store_id is null then
    raise exception 'Product store could not be resolved.';
  end if;

  if new.store_id is null then
    new.store_id := product_store_id;
  elsif new.store_id <> product_store_id then
    raise exception 'Inventory row store must match product store.';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_stock_set_store_id on public.inventory_stock;
create trigger inventory_stock_set_store_id
before insert or update of product_id, store_id on public.inventory_stock
for each row execute function public.set_inventory_row_store_id();

drop trigger if exists inventory_movements_set_store_id on public.inventory_movements;
create trigger inventory_movements_set_store_id
before insert or update of product_id, store_id on public.inventory_movements
for each row execute function public.set_inventory_row_store_id();

create or replace function public.current_staff_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select sp.store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.user_id, sp.auth_user_id) = auth.uid()
    and sp.role in ('manager', 'receptionist')
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and s.store_access_status = 'active'
  limit 1;
$$;

create or replace function public.is_greenchoice_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_store_id() is not null;
$$;

create or replace function public.is_greenchoice_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    join public.stores s on s.id = sp.store_id
    where coalesce(sp.user_id, sp.auth_user_id) = auth.uid()
      and sp.role = 'manager'
      and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
      and s.store_access_status = 'active'
  );
$$;

create or replace function public.is_store_member(target_store uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_store is not null
    and (
      public.is_greenchoice_admin()
      or exists (
        select 1 from public.store_memberships sm
        join public.stores s on s.id = sm.store_id
        where sm.store_id = target_store
          and sm.user_id = auth.uid()
          and s.store_access_status = 'active'
      )
      or exists (
        select 1 from public.staff_profiles sp
        join public.stores s on s.id = sp.store_id
        where sp.store_id = target_store
          and coalesce(sp.user_id, sp.auth_user_id) = auth.uid()
          and sp.role in ('manager','receptionist')
          and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
          and s.store_access_status = 'active'
      )
    );
$$;

create or replace function public.has_store_role(target_store uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_store is not null
    and (
      public.is_greenchoice_admin()
      or exists (
        select 1 from public.store_memberships sm
        join public.stores s on s.id = sm.store_id
        where sm.store_id = target_store
          and sm.user_id = auth.uid()
          and sm.role = any(roles)
          and s.store_access_status = 'active'
      )
      or exists (
        select 1 from public.staff_profiles sp
        join public.stores s on s.id = sp.store_id
        where sp.store_id = target_store
          and coalesce(sp.user_id, sp.auth_user_id) = auth.uid()
          and (
            (sp.role = 'manager' and ('manager' = any(roles) or 'admin' = any(roles) or 'catalog_manager' = any(roles)))
            or (sp.role = 'receptionist' and 'receptionist' = any(roles))
          )
          and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
          and s.store_access_status = 'active'
      )
    );
$$;

grant execute on function public.current_staff_store_id() to authenticated, service_role;
grant execute on function public.is_greenchoice_staff() to authenticated, service_role;
grant execute on function public.is_greenchoice_manager() to authenticated, service_role;
grant execute on function public.is_store_member(uuid) to authenticated, service_role;
grant execute on function public.has_store_role(uuid, text[]) to authenticated, service_role;

drop policy if exists products_staff_select on public.products;
drop policy if exists products_member_read on public.products;
drop policy if exists products_admin_write on public.products;
drop policy if exists manager_products_select on public.products;
drop policy if exists manager_products_insert on public.products;
drop policy if exists manager_products_update on public.products;
drop policy if exists products_store_select on public.products;
drop policy if exists products_store_insert on public.products;
drop policy if exists products_store_update on public.products;

create policy products_store_select
on public.products for select
using (public.is_store_member(store_id));

create policy products_store_insert
on public.products for insert
with check (public.has_store_role(store_id, array['manager','admin','catalog_manager']));

create policy products_store_update
on public.products for update
using (public.has_store_role(store_id, array['manager','admin','catalog_manager']))
with check (public.has_store_role(store_id, array['manager','admin','catalog_manager']));

drop policy if exists inventory_stock_staff_select on public.inventory_stock;
drop policy if exists manager_inventory_stock_select on public.inventory_stock;
drop policy if exists manager_inventory_stock_insert on public.inventory_stock;
drop policy if exists manager_inventory_stock_update on public.inventory_stock;
drop policy if exists inventory_stock_store_select on public.inventory_stock;
drop policy if exists inventory_stock_store_insert on public.inventory_stock;
drop policy if exists inventory_stock_store_update on public.inventory_stock;

create policy inventory_stock_store_select
on public.inventory_stock for select
using (public.is_store_member(store_id));

create policy inventory_stock_store_insert
on public.inventory_stock for insert
with check (public.has_store_role(store_id, array['manager','admin','catalog_manager']));

create policy inventory_stock_store_update
on public.inventory_stock for update
using (public.has_store_role(store_id, array['manager','admin','catalog_manager']))
with check (public.has_store_role(store_id, array['manager','admin','catalog_manager']));

drop policy if exists manager_inventory_movements_select on public.inventory_movements;
drop policy if exists manager_inventory_movements_insert on public.inventory_movements;
drop policy if exists inventory_movements_store_select on public.inventory_movements;
drop policy if exists inventory_movements_store_insert on public.inventory_movements;

create policy inventory_movements_store_select
on public.inventory_movements for select
using (public.is_store_member(store_id));

create policy inventory_movements_store_insert
on public.inventory_movements for insert
with check (public.has_store_role(store_id, array['manager','admin','catalog_manager']));

drop policy if exists staff_profiles_manager_read on public.staff_profiles;
drop policy if exists staff_profiles_manager_insert on public.staff_profiles;
drop policy if exists staff_profiles_manager_update on public.staff_profiles;
drop policy if exists staff_profiles_store_manager_read on public.staff_profiles;
drop policy if exists staff_profiles_store_manager_insert on public.staff_profiles;
drop policy if exists staff_profiles_store_manager_update on public.staff_profiles;

create policy staff_profiles_store_manager_read
on public.staff_profiles for select
using (
  public.is_greenchoice_admin()
  or coalesce(user_id, auth_user_id) = auth.uid()
  or (
    store_id = public.current_staff_store_id()
    and role in ('manager','receptionist')
  )
);

create policy staff_profiles_store_manager_insert
on public.staff_profiles for insert
with check (
  role = 'receptionist'
  and store_id = public.current_staff_store_id()
);

create policy staff_profiles_store_manager_update
on public.staff_profiles for update
using (
  role = 'receptionist'
  and store_id = public.current_staff_store_id()
)
with check (
  role = 'receptionist'
  and store_id = public.current_staff_store_id()
);

drop policy if exists stores_member_read on public.stores;
create policy stores_member_read
on public.stores for select
using (public.is_store_member(id));

drop policy if exists pos_sales_staff_select on public.pos_sales;
create policy pos_sales_staff_select
on public.pos_sales for select
using (public.is_store_member(store_id));

drop policy if exists pos_sale_items_staff_select on public.pos_sale_items;
create policy pos_sale_items_staff_select
on public.pos_sale_items for select
using (
  exists (
    select 1
    from public.pos_sales ps
    where ps.id = sale_id
      and public.is_store_member(ps.store_id)
  )
);

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

    select p.id, p.product_name, p.category, p.subcategory, p.price, p.product_status, p.deleted_at
    into product_row
    from public.products p
    where p.id = (item->>'product_id')::uuid
      and p.store_id = staff_store_id
    for update;

    if product_row.id is null or product_row.deleted_at is not null or product_row.product_status <> 'active' then
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
