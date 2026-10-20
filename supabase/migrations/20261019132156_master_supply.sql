begin;

-- Master Supply is franchise-owned. Store supplier stock remains in the existing
-- products/inventory_stock tables; the source balance below tracks only units
-- received through a confirmed master distribution.
create table public.master_supply_products (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references public.franchises(id) on delete restrict,
  sku text not null,
  name text not null,
  category text not null,
  subcategory text not null default '',
  strain_type text,
  cultivation_type text,
  price numeric(12,2) not null check (price >= 0),
  image_url text,
  description text not null default '',
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= on_hand),
  total_received integer not null default 0 check (total_received >= 0),
  last_received_at timestamptz,
  created_at timestamptz not null default now(),
  unique(franchise_id, sku)
);
create index master_supply_products_franchise_idx on public.master_supply_products(franchise_id, name);
create unique index master_supply_sku_ci_idx on public.master_supply_products(franchise_id, lower(sku));
create unique index master_supply_product_identity_idx on public.master_supply_products(
  franchise_id, lower(name), category, lower(subcategory),
  lower(coalesce(strain_type,'')), lower(coalesce(cultivation_type,''))
);

create table public.master_supply_receipts (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references public.franchises(id) on delete restrict,
  product_id uuid not null references public.master_supply_products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  actor_id uuid not null references auth.users(id),
  reason text not null default 'Central stock received',
  created_at timestamptz not null default now()
);
create index master_supply_receipts_product_idx on public.master_supply_receipts(product_id, created_at desc);
create table public.master_supply_adjustments (
  id uuid primary key,
  franchise_id uuid not null references public.franchises(id) on delete restrict,
  product_id uuid not null references public.master_supply_products(id) on delete restrict,
  delta integer not null check (delta <> 0),
  previous_quantity integer not null check (previous_quantity >= 0),
  new_quantity integer not null check (new_quantity >= 0),
  reason text not null check (length(btrim(reason)) between 5 and 500),
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index master_supply_adjustments_product_idx on public.master_supply_adjustments(product_id, created_at desc);

create table public.master_supply_requests (
  id uuid primary key,
  franchise_id uuid not null references public.franchises(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  requested_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending','approved','partially_approved','rejected','fulfilled','partially_fulfilled')),
  notes text not null default '',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index master_supply_requests_franchise_idx on public.master_supply_requests(franchise_id, created_at desc);
create index master_supply_requests_store_idx on public.master_supply_requests(store_id, created_at desc);
create table public.master_supply_request_items (
  request_id uuid not null references public.master_supply_requests(id) on delete restrict,
  product_id uuid not null references public.master_supply_products(id) on delete restrict,
  requested_quantity integer not null check (requested_quantity > 0),
  approved_quantity integer check (approved_quantity >= 0 and approved_quantity <= requested_quantity),
  primary key(request_id, product_id)
);

create table public.master_supply_distributions (
  id uuid primary key,
  franchise_id uuid not null references public.franchises(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  request_id uuid unique references public.master_supply_requests(id) on delete restrict,
  status text not null default 'reserved' check (status in ('reserved','in_transit','delivered','discrepancy','cancelled')),
  delivery_method text not null check (delivery_method in ('standard','collection')),
  notes text not null default '',
  distributed_by uuid not null references auth.users(id),
  received_by uuid references auth.users(id),
  dispatched_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now()
);
create index master_supply_distributions_franchise_idx on public.master_supply_distributions(franchise_id, created_at desc);
create index master_supply_distributions_store_idx on public.master_supply_distributions(store_id, created_at desc);
create table public.master_supply_distribution_items (
  distribution_id uuid not null references public.master_supply_distributions(id) on delete restrict,
  product_id uuid not null references public.master_supply_products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  received_quantity integer check (received_quantity >= 0 and received_quantity <= quantity),
  primary key(distribution_id, product_id)
);

create table public.master_supply_store_stock (
  store_id uuid not null references public.stores(id) on delete restrict,
  franchise_id uuid not null references public.franchises(id) on delete restrict,
  master_product_id uuid not null references public.master_supply_products(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 0 check (quantity >= 0),
  received_total integer not null default 0 check (received_total >= 0),
  sold_total integer not null default 0 check (sold_total >= 0),
  updated_at timestamptz not null default now(),
  primary key(store_id, master_product_id),
  unique(store_id, product_id)
);
create table public.master_supply_sale_allocations (
  sale_item_id uuid primary key references public.pos_sale_items(id) on delete restrict,
  sale_id uuid not null references public.pos_sales(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  franchise_id uuid not null references public.franchises(id) on delete restrict,
  master_product_id uuid not null references public.master_supply_products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);
create index master_supply_sale_allocations_franchise_idx on public.master_supply_sale_allocations(franchise_id, created_at desc);
create table public.master_supply_restocks (
  id uuid primary key,
  sale_item_id uuid not null references public.master_supply_sale_allocations(sale_item_id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  franchise_id uuid not null references public.franchises(id) on delete restrict,
  master_product_id uuid not null references public.master_supply_products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  actor_id uuid not null references auth.users(id),
  reason text not null check (length(btrim(reason)) between 5 and 500),
  created_at timestamptz not null default now()
);
create index master_supply_restocks_sale_item_idx on public.master_supply_restocks(sale_item_id);

create table public.master_supply_events (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references public.franchises(id) on delete restrict,
  store_id uuid references public.stores(id) on delete restrict,
  actor_id uuid references auth.users(id),
  action text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function private.master_supply_franchise_id() returns uuid
language sql stable security definer set search_path = pg_catalog, public as $$
  select case when sp.role = 'franchise_admin' then sp.franchise_id else st.franchise_id end
  from public.staff_profiles sp
  left join public.stores st on st.id = sp.store_id
  where sp.auth_user_id = (select auth.uid()) and sp.role in ('franchise_admin','manager')
    and sp.is_active and sp.account_status = 'active' and sp.account_setup_complete
    and (sp.role = 'franchise_admin' or (st.is_active and st.store_access_status = 'active'))
  limit 1;
$$;
revoke all on function private.master_supply_franchise_id() from public, anon;
grant execute on function private.master_supply_franchise_id() to authenticated;

do $$ declare t text; begin
  foreach t in array array[
    'master_supply_products','master_supply_receipts','master_supply_adjustments','master_supply_requests',
    'master_supply_request_items','master_supply_distributions',
    'master_supply_distribution_items','master_supply_store_stock',
    'master_supply_sale_allocations','master_supply_restocks','master_supply_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

create policy master_product_read on public.master_supply_products for select to authenticated
  using (franchise_id = (select private.master_supply_franchise_id()));
create policy master_receipt_read on public.master_supply_receipts for select to authenticated
  using (franchise_id = (select private.current_franchise_id()));
create policy master_adjustment_read on public.master_supply_adjustments for select to authenticated
  using (franchise_id = (select private.current_franchise_id()));
create policy master_request_read on public.master_supply_requests for select to authenticated
  using (franchise_id = (select private.current_franchise_id()) or
    (store_id = (select public.current_staff_store_id()) and franchise_id = (select private.master_supply_franchise_id())));
create policy master_request_item_read on public.master_supply_request_items for select to authenticated
  using (exists(select 1 from public.master_supply_requests r where r.id=request_id));
create policy master_distribution_read on public.master_supply_distributions for select to authenticated
  using (franchise_id = (select private.current_franchise_id()) or
    (store_id = (select public.current_staff_store_id()) and franchise_id = (select private.master_supply_franchise_id())));
create policy master_distribution_item_read on public.master_supply_distribution_items for select to authenticated
  using (exists(select 1 from public.master_supply_distributions d where d.id=distribution_id));
create policy master_store_stock_read on public.master_supply_store_stock for select to authenticated
  using (franchise_id = (select private.current_franchise_id()) or
    (store_id = (select public.current_staff_store_id()) and franchise_id = (select private.master_supply_franchise_id())));
create policy master_sale_allocations_read on public.master_supply_sale_allocations for select to authenticated
  using (franchise_id = (select private.current_franchise_id()) or
    (store_id = (select public.current_staff_store_id()) and franchise_id = (select private.master_supply_franchise_id())));
create policy master_restocks_read on public.master_supply_restocks for select to authenticated
  using (franchise_id = (select private.current_franchise_id()) or
    (store_id = (select public.current_staff_store_id()) and franchise_id = (select private.master_supply_franchise_id())));
create policy master_events_read on public.master_supply_events for select to authenticated
  using (franchise_id = (select private.current_franchise_id()) or
    (store_id = (select public.current_staff_store_id()) and franchise_id = (select private.master_supply_franchise_id())));

-- The existing POS inserts sale items before decrementing inventory_stock.
-- Allocate implicit independent stock first, then master units. The insert and
-- subsequent stock decrement run in the same transaction and roll back together.
create function private.allocate_master_sale() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_store uuid; v_stock numeric; v_master integer; v_independent numeric; v_take integer; v_source record;
begin
  select store_id into v_store from public.pos_sales where id = new.sale_id;
  select * into v_source from public.master_supply_store_stock
    where store_id = v_store and product_id = new.product_id for update;
  if v_source.store_id is null then return new; end if;
  select current_quantity into v_stock from public.inventory_stock
    where store_id = v_store and product_id = new.product_id for update;
  v_master := v_source.quantity;
  v_independent := greatest(0, floor(coalesce(v_stock, 0) - v_master));
  v_take := least(v_master, greatest(0, new.quantity - v_independent));
  if v_take > 0 then
    update public.master_supply_store_stock set quantity = quantity - v_take,
      sold_total = sold_total + v_take, updated_at = now()
    where store_id = v_store and product_id = new.product_id;
    insert into public.master_supply_sale_allocations
      (sale_item_id,sale_id,store_id,franchise_id,master_product_id,quantity)
    values(new.id,new.sale_id,v_store,v_source.franchise_id,v_source.master_product_id,v_take);
  end if;
  return new;
end $$;
create trigger master_supply_pos_allocation after insert on public.pos_sale_items
  for each row execute function private.allocate_master_sale();

create function private.notify_master_refund() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_source record;
begin
  if new.refunded_amount is not distinct from old.refunded_amount
    and new.status is not distinct from old.status then return new; end if;
  for v_source in select distinct franchise_id,store_id from public.master_supply_sale_allocations where sale_id=new.id loop
    insert into public.master_supply_events(franchise_id,store_id,action,target_id,details)
    values(v_source.franchise_id,v_source.store_id,'refund_changed',new.id,
      jsonb_build_object('refundedAmount',new.refunded_amount,'status',new.status));
  end loop;
  return new;
end $$;
create trigger master_supply_refund_event after update of refunded_amount,status on public.pos_sales
  for each row execute function private.notify_master_refund();

create function private.guard_master_store_balance() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_master integer;
begin
  if tg_op = 'DELETE' then
    select quantity into v_master from public.master_supply_store_stock
      where store_id = old.store_id and product_id = old.product_id;
    if coalesce(v_master,0) > 0 then raise exception 'Master Supply stock must be reconciled before inventory deletion.'; end if;
    return old;
  end if;
  select quantity into v_master from public.master_supply_store_stock
    where store_id = new.store_id and product_id = new.product_id;
  if coalesce(v_master,0) > new.current_quantity then
    raise exception 'Stock change would remove unallocated Master Supply units.';
  end if;
  return new;
end $$;
create trigger master_supply_stock_guard before update of current_quantity on public.inventory_stock
  for each row execute function private.guard_master_store_balance();
create trigger master_supply_stock_delete_guard before delete on public.inventory_stock
  for each row execute function private.guard_master_store_balance();

-- Online checkout reserves published products before it creates a POS sale.
-- Keep Master Supply's source-specific POS product out of that reservation path.
create function private.guard_master_product_publication() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.is_published and exists(
    select 1 from public.master_supply_store_stock where product_id = new.id
  ) then
    raise exception 'Master Supply POS products cannot be published for online checkout.';
  end if;
  return new;
end $$;
create trigger master_supply_product_publication_guard before update of is_published on public.products
  for each row execute function private.guard_master_product_publication();

-- Called only by trusted server actions with the actor from the authenticated
-- session. The database rechecks role, franchise, store and stock under locks.
create function public.master_supply_mutation(p_actor uuid, p_action text, p_data jsonb)
returns uuid language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_staff record; v_franchise uuid; v_store uuid; v_id uuid; v_product record;
  v_request public.master_supply_requests%rowtype; v_distribution public.master_supply_distributions%rowtype;
  v_item jsonb; v_quantity integer; v_received integer; v_product_id uuid;
  v_store_product uuid; v_category uuid; v_stock numeric; v_requested integer;
  v_seen uuid[] := '{}'; v_name text; v_existing record;
begin
  if p_actor is null or p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Invalid Master Supply action.';
  end if;
  select sp.role, sp.store_id, sp.franchise_id, sp.is_active, sp.account_status,
    sp.account_setup_complete, st.franchise_id as store_franchise,
    st.is_active as store_active, st.store_access_status
  into v_staff from public.staff_profiles sp left join public.stores st on st.id=sp.store_id
  where sp.auth_user_id=p_actor limit 1;
  if v_staff.role not in ('franchise_admin','manager') or not v_staff.is_active
    or v_staff.account_status <> 'active' or v_staff.account_setup_complete is distinct from true then
    raise exception 'Master Supply access denied.' using errcode='42501';
  end if;
  v_franchise := case when v_staff.role='franchise_admin' then v_staff.franchise_id else v_staff.store_franchise end;
  v_store := v_staff.store_id;
  if v_franchise is null then raise exception 'Franchise assignment required.' using errcode='42501'; end if;
  if v_staff.role='manager' and (v_staff.store_active is distinct from true or v_staff.store_access_status <> 'active') then
    raise exception 'Store access is restricted.' using errcode='42501';
  end if;
  if p_action in ('create_product','add_stock','adjust_central','review_request','distribute','dispatch','cancel')
    and v_staff.role <> 'franchise_admin' then
    raise exception 'Franchise administrator required.' using errcode='42501';
  end if;

  if p_action = 'create_product' then
    v_id := (p_data->>'id')::uuid;
    if exists(select 1 from public.master_supply_products where id=v_id and franchise_id=v_franchise) then return v_id; end if;
    v_name := btrim(p_data->>'name');
    if length(v_name) not between 2 and 120 or length(btrim(p_data->>'sku')) not between 2 and 60
      or (p_data->>'price')::numeric < 0 then raise exception 'Check product details.'; end if;
    if not exists(select 1 from public.categories where name=p_data->>'category' and is_active) then raise exception 'Choose an available category.'; end if;
    if p_data->>'category' in ('Flower','Pre-Rolls') and coalesce(p_data->>'cultivationType','') not in ('Indoor','Greenhouse','Outdoor') then
      raise exception 'Choose an available cultivation.';
    elsif p_data->>'category'='Vape Cartridges' and coalesce(p_data->>'cultivationType','') not in ('Sativa','Indica','Hybrid') then
      raise exception 'Choose a vape strain.';
    elsif p_data->>'category' not in ('Flower','Pre-Rolls','Vape Cartridges') and coalesce(p_data->>'cultivationType','') <> '' then
      raise exception 'Cultivation is unavailable for this category.';
    end if;
    insert into public.master_supply_products(id,franchise_id,sku,name,category,subcategory,strain_type,cultivation_type,price,image_url,description)
    values(v_id,v_franchise,btrim(p_data->>'sku'),v_name,p_data->>'category',coalesce(p_data->>'subcategory',''),
      nullif(p_data->>'strainType',''),nullif(p_data->>'cultivationType',''),(p_data->>'price')::numeric,
      nullif(p_data->>'imageUrl',''),coalesce(p_data->>'description',''));
    v_quantity := coalesce((p_data->>'quantity')::integer,0);
    if v_quantity < 0 or v_quantity > 1000000 then raise exception 'Invalid received quantity.'; end if;
    if v_quantity > 0 then
      update public.master_supply_products set on_hand=v_quantity,total_received=v_quantity,last_received_at=now() where id=v_id;
      insert into public.master_supply_receipts(franchise_id,product_id,quantity,actor_id)
      values(v_franchise,v_id,v_quantity,p_actor);
    end if;
  elsif p_action = 'add_stock' then
    v_id := (p_data->>'productId')::uuid; v_quantity := (p_data->>'quantity')::integer;
    if v_quantity is null or v_quantity <= 0 or v_quantity > 1000000 then raise exception 'Quantity must be positive.'; end if;
    if exists(select 1 from public.master_supply_receipts where id=(p_data->>'id')::uuid) then
      if exists(select 1 from public.master_supply_receipts where id=(p_data->>'id')::uuid and franchise_id=v_franchise and product_id=v_id and quantity=v_quantity) then return v_id; end if;
      raise exception 'Receipt key was already used.';
    end if;
    update public.master_supply_products set on_hand=on_hand+v_quantity,
      total_received=total_received+v_quantity,last_received_at=now()
    where id=v_id and franchise_id=v_franchise returning * into v_product;
    if v_product.id is null then raise exception 'Product not found.' using errcode='42501'; end if;
    insert into public.master_supply_receipts(id,franchise_id,product_id,quantity,actor_id,reason)
    values((p_data->>'id')::uuid,v_franchise,v_id,v_quantity,p_actor,coalesce(nullif(p_data->>'reason',''),'Central stock received'));
  elsif p_action = 'adjust_central' then
    v_id := (p_data->>'id')::uuid; v_product_id := (p_data->>'productId')::uuid;
    v_quantity := (p_data->>'delta')::integer;
    if v_quantity is null or v_quantity=0 or abs(v_quantity)>1000000
      or length(btrim(coalesce(p_data->>'reason',''))) not between 5 and 500 then
      raise exception 'A nonzero adjustment and reason are required.';
    end if;
    if exists(select 1 from public.master_supply_adjustments where id=v_id and franchise_id=v_franchise and product_id=v_product_id and delta=v_quantity) then return v_id; end if;
    select * into v_product from public.master_supply_products where id=v_product_id and franchise_id=v_franchise for update;
    if v_product.id is null then raise exception 'Product not found.' using errcode='42501'; end if;
    if v_product.on_hand+v_quantity < v_product.reserved then raise exception 'Adjustment would consume reserved stock.'; end if;
    update public.master_supply_products set on_hand=on_hand+v_quantity where id=v_product_id;
    insert into public.master_supply_adjustments(id,franchise_id,product_id,delta,previous_quantity,new_quantity,reason,actor_id)
      values(v_id,v_franchise,v_product_id,v_quantity,v_product.on_hand,v_product.on_hand+v_quantity,btrim(p_data->>'reason'),p_actor);
  elsif p_action = 'request' then
    if v_staff.role <> 'manager' or v_store is null then raise exception 'Store manager required.' using errcode='42501'; end if;
    v_id := (p_data->>'id')::uuid;
    if exists(select 1 from public.master_supply_requests where id=v_id and store_id=v_store and requested_by=p_actor) then return v_id; end if;
    if jsonb_typeof(p_data->'items') <> 'array' or jsonb_array_length(p_data->'items') not between 1 and 100 then raise exception 'Select products.'; end if;
    insert into public.master_supply_requests(id,franchise_id,store_id,requested_by,notes)
      values(v_id,v_franchise,v_store,p_actor,left(coalesce(p_data->>'notes',''),500));
    for v_item in select * from jsonb_array_elements(p_data->'items') loop
      v_product_id := (v_item->>'productId')::uuid; v_quantity := (v_item->>'quantity')::integer;
      if v_quantity is null or v_quantity <= 0 or v_quantity > 1000000 then raise exception 'Invalid requested quantity.'; end if;
      if not exists(select 1 from public.master_supply_products where id=v_product_id and franchise_id=v_franchise) then raise exception 'Product outside franchise.' using errcode='42501'; end if;
      insert into public.master_supply_request_items(request_id,product_id,requested_quantity)
        values(v_id,v_product_id,v_quantity);
    end loop;
  elsif p_action = 'review_request' then
    v_id := (p_data->>'requestId')::uuid;
    select * into v_request from public.master_supply_requests where id=v_id and franchise_id=v_franchise for update;
    if v_request.id is null or v_request.status not in ('pending','approved','partially_approved') then raise exception 'Request cannot be reviewed.'; end if;
    if exists(select 1 from public.master_supply_distributions where request_id=v_id) then raise exception 'Request already converted.'; end if;
    if p_data->>'decision' = 'reject' then
      update public.master_supply_request_items set approved_quantity=0 where request_id=v_id;
      update public.master_supply_requests set status='rejected',reviewed_by=p_actor,reviewed_at=now() where id=v_id;
    elsif p_data->>'decision' in ('approve','partial') then
      if p_data->>'decision'='approve' then
        update public.master_supply_request_items set approved_quantity=requested_quantity where request_id=v_id;
      else
        if jsonb_typeof(p_data->'items') <> 'array' then raise exception 'Approved quantities required.'; end if;
        update public.master_supply_request_items set approved_quantity=0 where request_id=v_id;
        for v_item in select * from jsonb_array_elements(p_data->'items') loop
          update public.master_supply_request_items set approved_quantity=(v_item->>'quantity')::integer
          where request_id=v_id and product_id=(v_item->>'productId')::uuid;
          if not found then raise exception 'Request product not found.'; end if;
        end loop;
      end if;
      if not exists(select 1 from public.master_supply_request_items where request_id=v_id and approved_quantity>0) then raise exception 'Approve at least one unit.'; end if;
      update public.master_supply_requests set status=case when exists(
        select 1 from public.master_supply_request_items where request_id=v_id and approved_quantity<requested_quantity
      ) then 'partially_approved' else 'approved' end,reviewed_by=p_actor,reviewed_at=now() where id=v_id;
    else raise exception 'Invalid decision.'; end if;
  elsif p_action = 'distribute' then
    v_id := (p_data->>'id')::uuid; v_store := (p_data->>'storeId')::uuid;
    if exists(select 1 from public.master_supply_distributions where id=v_id and franchise_id=v_franchise) then return v_id; end if;
    if not exists(select 1 from public.stores where id=v_store and franchise_id=v_franchise and is_active and store_access_status='active') then raise exception 'Destination store outside franchise.' using errcode='42501'; end if;
    if p_data->>'deliveryMethod' not in ('standard','collection') then raise exception 'Choose delivery method.'; end if;
    if jsonb_typeof(p_data->'items') <> 'array' or jsonb_array_length(p_data->'items') not between 1 and 100 then raise exception 'Select products.'; end if;
    if nullif(p_data->>'requestId','') is not null then
      select * into v_request from public.master_supply_requests where id=(p_data->>'requestId')::uuid and franchise_id=v_franchise for update;
      if v_request.id is null or v_request.store_id <> v_store or v_request.status not in ('approved','partially_approved') then raise exception 'Request is not eligible for distribution.'; end if;
      if exists(select 1 from public.master_supply_distributions where request_id=v_request.id) then raise exception 'Request already converted.'; end if;
    end if;
    insert into public.master_supply_distributions(id,franchise_id,store_id,request_id,delivery_method,notes,distributed_by)
    values(v_id,v_franchise,v_store,v_request.id,p_data->>'deliveryMethod',left(coalesce(p_data->>'notes',''),500),p_actor);
    for v_item in select * from jsonb_array_elements(p_data->'items') loop
      v_product_id := (v_item->>'productId')::uuid; v_quantity := (v_item->>'quantity')::integer;
      if v_quantity is null or v_quantity <= 0 or v_quantity > 1000000 then raise exception 'Invalid distribution quantity.'; end if;
      if v_request.id is not null then
        select approved_quantity into v_requested from public.master_supply_request_items where request_id=v_request.id and product_id=v_product_id;
        if v_requested is null or v_quantity > v_requested then raise exception 'Quantity exceeds request approval.'; end if;
      end if;
      update public.master_supply_products set reserved=reserved+v_quantity
        where id=v_product_id and franchise_id=v_franchise and on_hand-reserved>=v_quantity returning * into v_product;
      if v_product.id is null then raise exception 'Insufficient central stock.'; end if;
      insert into public.master_supply_distribution_items(distribution_id,product_id,quantity) values(v_id,v_product_id,v_quantity);
    end loop;
  elsif p_action in ('dispatch','cancel') then
    v_id := (p_data->>'distributionId')::uuid;
    select * into v_distribution from public.master_supply_distributions where id=v_id and franchise_id=v_franchise for update;
    if v_distribution.id is null or v_distribution.status <> 'reserved' then raise exception 'Distribution is not reserved.'; end if;
    for v_existing in select * from public.master_supply_distribution_items where distribution_id=v_id order by product_id loop
      if p_action='dispatch' then
        update public.master_supply_products set on_hand=on_hand-v_existing.quantity,reserved=reserved-v_existing.quantity
          where id=v_existing.product_id and franchise_id=v_franchise and reserved>=v_existing.quantity and on_hand>=v_existing.quantity;
      else
        update public.master_supply_products set reserved=reserved-v_existing.quantity
          where id=v_existing.product_id and franchise_id=v_franchise and reserved>=v_existing.quantity;
      end if;
      if not found then raise exception 'Central stock changed.'; end if;
    end loop;
    update public.master_supply_distributions set status=case when p_action='dispatch' then 'in_transit' else 'cancelled' end,
      dispatched_at=case when p_action='dispatch' then now() else null end where id=v_id;
  elsif p_action = 'receive' then
    if v_staff.role <> 'manager' or v_store is null then raise exception 'Store manager required.' using errcode='42501'; end if;
    v_id := (p_data->>'distributionId')::uuid;
    select * into v_distribution from public.master_supply_distributions where id=v_id and store_id=v_store and franchise_id=v_franchise for update;
    if v_distribution.id is null or v_distribution.status <> 'in_transit' then raise exception 'Distribution is not awaiting receipt.'; end if;
    if jsonb_typeof(p_data->'items') <> 'array' then raise exception 'Received quantities required.'; end if;
    for v_existing in select * from public.master_supply_distribution_items where distribution_id=v_id order by product_id loop
      select (x->>'quantity')::integer into v_received from jsonb_array_elements(p_data->'items') x
        where (x->>'productId')::uuid=v_existing.product_id limit 1;
      if v_received is null or v_received < 0 or v_received > v_existing.quantity then raise exception 'Invalid received quantity.'; end if;
      select * into v_product from public.master_supply_products where id=v_existing.product_id and franchise_id=v_franchise;
      select product_id into v_store_product from public.master_supply_store_stock
        where store_id=v_store and master_product_id=v_product.id;
      if v_store_product is null then
        -- A distinct POS listing preserves origin when an identical supplier
        -- product is published for online checkout. It is never shop-published.
        select id into v_category from public.categories where name=v_product.category and is_active limit 1;
        if v_category is null then raise exception 'Product category is unavailable.'; end if;
        insert into public.products(store_id,category_id,subcategory_slug,slug,name,description,price_cents,
          product_name,category,subcategory,cultivation_type,strain_type,price,product_status,image_url,is_published)
        values(v_store,v_category,coalesce(nullif(v_product.subcategory,''),'general'),
          'master-'||v_product.id::text||'-'||v_store::text,v_product.name||' (Master Supply)',v_product.description,
          (v_product.price*100)::integer,v_product.name||' (Master Supply)',v_product.category,v_product.subcategory,
          v_product.cultivation_type,v_product.strain_type,v_product.price,'active',v_product.image_url,false)
        returning id into v_store_product;
        insert into public.master_supply_store_stock(store_id,franchise_id,master_product_id,product_id)
          values(v_store,v_franchise,v_product.id,v_store_product);
      end if;
      if v_received > 0 then
        select current_quantity into v_stock from public.inventory_stock where product_id=v_store_product and store_id=v_store for update;
        if v_stock is null then
          insert into public.inventory_stock(store_id,product_id,current_quantity,last_updated_by)
            values(v_store,v_store_product,v_received,p_actor);
          v_stock := 0;
        else
          update public.inventory_stock set current_quantity=current_quantity+v_received,last_updated_by=p_actor
            where product_id=v_store_product and store_id=v_store;
        end if;
        update public.master_supply_store_stock set quantity=quantity+v_received,
          received_total=received_total+v_received,updated_at=now()
          where store_id=v_store and master_product_id=v_product.id;
        insert into public.inventory_movements(store_id,product_id,movement_type,quantity_changed,previous_quantity,new_quantity,reason,created_by)
          values(v_store,v_store_product,'stock_added',v_received,v_stock,v_stock+v_received,'Master Supply distribution '||v_id::text,p_actor);
      end if;
      update public.master_supply_distribution_items set received_quantity=v_received
        where distribution_id=v_id and product_id=v_product.id;
    end loop;
    update public.master_supply_distributions set status=case when exists(
      select 1 from public.master_supply_distribution_items where distribution_id=v_id and received_quantity<quantity
    ) then 'discrepancy' else 'delivered' end,received_by=p_actor,received_at=now() where id=v_id;
    if v_distribution.request_id is not null then
      update public.master_supply_requests set status=case when exists(
        select 1 from public.master_supply_request_items ri
        left join public.master_supply_distribution_items di on di.distribution_id=v_id and di.product_id=ri.product_id
        where ri.request_id=v_distribution.request_id and coalesce(di.received_quantity,0)<coalesce(ri.approved_quantity,0)
      ) then 'partially_fulfilled' else 'fulfilled' end where id=v_distribution.request_id;
    end if;
  elsif p_action = 'restock_refund' then
    if v_staff.role <> 'manager' or v_store is null then raise exception 'Store manager required.' using errcode='42501'; end if;
    if p_data->>'conditionConfirmed' <> 'true' then raise exception 'Confirm the returned product is suitable for restocking.'; end if;
    v_id := (p_data->>'id')::uuid;
    if exists(select 1 from public.master_supply_restocks where id=v_id and store_id=v_store and actor_id=p_actor) then return v_id; end if;
    v_quantity := (p_data->>'quantity')::integer;
    if v_quantity is null or v_quantity <= 0 or length(btrim(coalesce(p_data->>'reason',''))) not between 5 and 500 then raise exception 'Quantity and restock reason are required.'; end if;
    select a.*,s.total,s.refunded_amount,s.status into v_existing
      from public.master_supply_sale_allocations a
      join public.pos_sales s on s.id=a.sale_id
      where a.sale_item_id=(p_data->>'saleItemId')::uuid and a.store_id=v_store and a.franchise_id=v_franchise
      for update of a;
    if v_existing.sale_item_id is null or v_existing.status <> 'completed' or v_existing.refunded_amount <> v_existing.total or v_existing.total <= 0 then
      raise exception 'Only fully refunded Master Supply items can be restocked.';
    end if;
    select coalesce(sum(quantity),0) into v_requested from public.master_supply_restocks where sale_item_id=v_existing.sale_item_id;
    if v_requested+v_quantity > v_existing.quantity then raise exception 'Restock quantity exceeds the refunded Master Supply allocation.'; end if;
    select product_id into v_store_product from public.master_supply_store_stock
      where store_id=v_store and master_product_id=v_existing.master_product_id for update;
    select current_quantity into v_stock from public.inventory_stock where store_id=v_store and product_id=v_store_product for update;
    if v_store_product is null or v_stock is null then raise exception 'Store inventory is unavailable.'; end if;
    update public.inventory_stock set current_quantity=current_quantity+v_quantity,last_updated_by=p_actor
      where store_id=v_store and product_id=v_store_product;
    update public.master_supply_store_stock set quantity=quantity+v_quantity,updated_at=now()
      where store_id=v_store and master_product_id=v_existing.master_product_id;
    insert into public.inventory_movements(store_id,product_id,movement_type,quantity_changed,previous_quantity,new_quantity,reason,created_by)
      values(v_store,v_store_product,'stock_added',v_quantity,v_stock,v_stock+v_quantity,
        'Restocked approved Master Supply refund: '||btrim(p_data->>'reason'),p_actor);
    insert into public.master_supply_restocks(id,sale_item_id,store_id,franchise_id,master_product_id,quantity,actor_id,reason)
      values(v_id,v_existing.sale_item_id,v_store,v_franchise,v_existing.master_product_id,v_quantity,p_actor,btrim(p_data->>'reason'));
  else raise exception 'Unknown Master Supply action.'; end if;

  insert into public.master_supply_events(franchise_id,store_id,actor_id,action,target_id,details)
    values(v_franchise,case when p_action in ('request','receive','distribute','dispatch','cancel','restock_refund') then
      coalesce(v_store,v_distribution.store_id) else null end,p_actor,p_action,v_id,
      jsonb_build_object('productId',p_data->>'productId','requestId',p_data->>'requestId'));
  return v_id;
end $$;
revoke all on function public.master_supply_mutation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.master_supply_mutation(uuid,text,jsonb) to service_role;

-- Supabase Realtime emits only franchise-scoped rows after commit. The client
-- subscribes with the user's authenticated session and RLS still applies.
do $$ declare t text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['master_supply_products','master_supply_requests','master_supply_distributions','master_supply_store_stock','master_supply_sale_allocations','master_supply_events'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;

commit;
