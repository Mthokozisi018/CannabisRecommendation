create extension if not exists pgcrypto;

create or replace function public.add_inventory_stock_atomic(
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
  caller_id uuid := auth.uid();
  manager_store_id uuid;
  stock_row record;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if p_product_id is null or p_quantity is null or p_quantity <= 0 or p_quantity > 1000000 then
    raise exception using errcode = '22023', message = 'Invalid stock quantity.';
  end if;

  select sp.store_id
  into manager_store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.auth_user_id, sp.user_id) = caller_id
    and sp.role = 'manager'
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  limit 1;

  if manager_store_id is null then
    raise exception using errcode = '42501', message = 'Manager access denied.';
  end if;

  if not exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.store_id = manager_store_id
      and p.deleted_at is null
  ) then
    raise exception using errcode = '23503', message = 'Product is unavailable.';
  end if;

  select s.id, s.current_quantity
  into stock_row
  from public.inventory_stock s
  where s.product_id = p_product_id
    and s.store_id = manager_store_id
  for update;

  if stock_row.id is null or stock_row.current_quantity is null or
     stock_row.current_quantity <> trunc(stock_row.current_quantity) then
    raise exception using errcode = '23514', message = 'Inventory stock is invalid.';
  end if;

  stock_id := stock_row.id;
  previous_quantity := stock_row.current_quantity::integer;
  new_quantity := previous_quantity + p_quantity;

  update public.inventory_stock
  set current_quantity = new_quantity,
      last_updated_by = caller_id
  where id = stock_row.id
    and store_id = manager_store_id;

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
    manager_store_id,
    p_product_id,
    'stock_added',
    p_quantity,
    previous_quantity,
    new_quantity,
    left(coalesce(nullif(trim(p_reason), ''), 'manual_adjustment'), 240),
    caller_id
  );

  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (
    caller_id,
    'manager_added_inventory_stock',
    'inventory_stock',
    stock_row.id,
    manager_store_id,
    'completed',
    jsonb_build_object(
      'productId', p_product_id,
      'previousQuantity', previous_quantity,
      'quantityChanged', p_quantity,
      'newQuantity', new_quantity
    )
  );

  return next;
end;
$$;

revoke all on function public.add_inventory_stock_atomic(uuid, integer, text)
  from public, anon;
grant execute on function public.add_inventory_stock_atomic(uuid, integer, text)
  to authenticated;
alter function public.add_inventory_stock_atomic(uuid, integer, text)
  owner to postgres;
