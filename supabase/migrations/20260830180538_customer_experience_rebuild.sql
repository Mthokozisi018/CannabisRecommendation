-- Customer experience fulfillment, order lifecycle, recent-store history, and
-- delivery/payment foundations. This extends the pending online orders model.

create extension if not exists postgis with schema extensions;

alter table public.stores
  add column if not exists customer_location extensions.geography(Point, 4326)
  generated always as (
    case when latitude is not null and longitude is not null
      then extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
    end
  ) stored;

alter table public.customer_addresses
  add column if not exists customer_location extensions.geography(Point, 4326)
  generated always as (
    case when latitude is not null and longitude is not null
      then extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
    end
  ) stored;

create index if not exists stores_customer_location_gist_idx on public.stores using gist(customer_location);
create index if not exists customer_addresses_location_gist_idx on public.customer_addresses using gist(customer_location);

create table if not exists public.store_fulfillment_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  orders_enabled boolean not null default true,
  collection_enabled boolean not null default true,
  delivery_enabled boolean not null default false,
  collection_lead_minutes integer not null default 30 check (collection_lead_minutes between 0 and 1440),
  collection_minimum numeric(12,2) not null default 0 check (collection_minimum >= 0),
  collection_fee numeric(12,2) not null default 0 check (collection_fee >= 0),
  delivery_minimum numeric(12,2) not null default 0 check (delivery_minimum >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  delivery_eta_min_minutes integer check (delivery_eta_min_minutes between 1 and 1440),
  delivery_eta_max_minutes integer check (delivery_eta_max_minutes between 1 and 1440),
  delivery_radius_km numeric(7,2) check (delivery_radius_km > 0 and delivery_radius_km <= 500),
  updated_at timestamptz not null default now(),
  constraint store_fulfillment_eta_order check (
    delivery_eta_min_minutes is null or delivery_eta_max_minutes is null
    or delivery_eta_max_minutes >= delivery_eta_min_minutes
  )
);

insert into public.store_fulfillment_settings (store_id)
select id from public.stores
on conflict (store_id) do nothing;

create table if not exists public.store_media (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  media_type text not null check (media_type in ('cover','gallery')),
  public_url text not null check (char_length(public_url) between 1 and 2048),
  alt_text text check (alt_text is null or char_length(alt_text) <= 180),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists store_media_one_cover_idx
  on public.store_media(store_id) where media_type = 'cover';
create index if not exists store_media_store_sort_idx
  on public.store_media(store_id, media_type, sort_order, created_at);

create table if not exists public.customer_store_views (
  user_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  view_count integer not null default 1 check (view_count > 0),
  primary key (user_id, store_id)
);

create index if not exists customer_store_views_recent_idx
  on public.customer_store_views(user_id, last_viewed_at desc);

alter table public.orders
  drop constraint if exists orders_status_check,
  drop constraint if exists orders_payment_method_check,
  drop constraint if exists orders_payment_status_check;

alter table public.orders
  add column if not exists fulfillment_type text,
  add column if not exists customer_first_name_snapshot text,
  add column if not exists customer_surname_snapshot text,
  add column if not exists customer_phone_snapshot text,
  add column if not exists fulfillment_fee numeric(12,2) not null default 0,
  add column if not exists idempotency_key uuid,
  add column if not exists placed_at timestamptz,
  add column if not exists preparing_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists collection_expires_at timestamptz,
  add column if not exists collected_at timestamptz,
  add column if not exists out_for_delivery_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists cancellation_reason text;

alter table public.orders
  add constraint orders_status_check check (status in (
    'draft','confirmed','pending','placed','preparing','ready_for_collection',
    'out_for_delivery','cancelled','completed','collected','delivered','refunded','forfeited'
  )),
  add constraint orders_fulfillment_type_check
    check (fulfillment_type is null or fulfillment_type in ('collection','delivery')),
  add constraint orders_payment_method_check
    check (payment_method is null or payment_method in ('card','cash','online')),
  add constraint orders_payment_status_check
    check (payment_status is null or payment_status in ('awaiting_payment','pending','paid','failed','refunded')),
  add constraint orders_fulfillment_fee_check check (fulfillment_fee >= 0),
  add constraint orders_customer_snapshot_check check (
    customer_phone_snapshot is null or customer_phone_snapshot ~ '^\+27[0-9]{9}$'
  );

create unique index if not exists orders_customer_idempotency_uidx
  on public.orders(customer_id, idempotency_key) where idempotency_key is not null;
create index if not exists orders_collection_expiry_idx
  on public.orders(store_id, collection_expires_at)
  where status in ('pending','placed','preparing','ready_for_collection') and fulfillment_type = 'collection';

update public.orders
set fulfillment_type = 'collection',
    placed_at = coalesce(placed_at, created_at),
    collection_expires_at = coalesce(collection_expires_at, created_at + interval '4 days')
where customer_id is not null and fulfillment_type is null;

alter table public.order_items
  add column if not exists image_url_snapshot text;

create table if not exists public.order_fulfillment_details (
  order_id uuid primary key references public.orders(id) on delete cascade,
  fulfillment_type text not null check (fulfillment_type in ('collection','delivery')),
  store_name_snapshot text not null,
  store_address_snapshot text,
  recipient_first_name text not null,
  recipient_surname text not null,
  recipient_phone text not null check (recipient_phone ~ '^\+27[0-9]{9}$'),
  address_line text,
  suburb text,
  city text,
  province text,
  postal_code text,
  delivery_instructions text,
  delivery_eta_min_minutes integer,
  delivery_eta_max_minutes integer,
  created_at timestamptz not null default now(),
  constraint order_fulfillment_address_shape check (
    (fulfillment_type = 'collection' and address_line is null and suburb is null and city is null and province is null and postal_code is null)
    or
    (fulfillment_type = 'delivery' and address_line is not null and suburb is not null and city is not null and province is not null and postal_code ~ '^[0-9]{4}$')
  )
);

create table if not exists public.order_delivery_tracking (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null check (status in ('delivery_confirmed','driver_assigned','picked_up','out_for_delivery','delivered','delivery_failed')),
  provider text,
  provider_delivery_id text,
  provider_reference text,
  tracking_url text,
  estimated_arrival timestamptz,
  driver_name text,
  driver_phone text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index if not exists order_delivery_tracking_order_time_idx
  on public.order_delivery_tracking(order_id, occurred_at desc);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  provider_reference text,
  transaction_type text not null check (transaction_type in ('authorization','capture','payment','refund','void')),
  status text not null check (status in ('pending','succeeded','failed','cancelled')),
  amount numeric(12,2) not null check (amount >= 0),
  currency_code text not null default 'ZAR',
  idempotency_key text,
  failure_code text,
  initiated_at timestamptz not null default now(),
  paid_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_transactions_provider_ref_uidx
  on public.payment_transactions(provider, provider_reference)
  where provider_reference is not null;
create index if not exists payment_transactions_order_created_idx
  on public.payment_transactions(order_id, created_at desc);

alter table public.order_events drop constraint if exists order_events_event_type_check;
alter table public.order_events add constraint order_events_event_type_check check (event_type in (
  'created','placed','confirmed','preparing','ready_for_collection','collection_expired',
  'collected','delivery_confirmed','out_for_delivery','delivered','cancelled','completed','refunded','forfeited'
));

alter table public.store_fulfillment_settings enable row level security;
alter table public.store_media enable row level security;
alter table public.customer_store_views enable row level security;
alter table public.order_fulfillment_details enable row level security;
alter table public.order_delivery_tracking enable row level security;
alter table public.payment_transactions enable row level security;

drop policy if exists store_fulfillment_customer_read on public.store_fulfillment_settings;
create policy store_fulfillment_customer_read on public.store_fulfillment_settings
for select to authenticated using (private.is_active_customer());
drop policy if exists store_fulfillment_staff_read on public.store_fulfillment_settings;
create policy store_fulfillment_staff_read on public.store_fulfillment_settings
for select to authenticated using (public.is_store_member(store_id));

drop policy if exists store_media_customer_read on public.store_media;
create policy store_media_customer_read on public.store_media
for select to authenticated using (private.is_active_customer());
drop policy if exists store_media_staff_read on public.store_media;
create policy store_media_staff_read on public.store_media
for select to authenticated using (public.is_store_member(store_id));

drop policy if exists customer_store_views_self_all on public.customer_store_views;
create policy customer_store_views_self_all on public.customer_store_views
for all to authenticated
using ((select auth.uid()) = user_id and private.is_active_customer())
with check ((select auth.uid()) = user_id and private.is_active_customer());

drop policy if exists order_events_customer_read on public.order_events;
create policy order_events_customer_read on public.order_events
for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_events.order_id and o.customer_id = (select auth.uid()))
);

drop policy if exists order_fulfillment_customer_read on public.order_fulfillment_details;
create policy order_fulfillment_customer_read on public.order_fulfillment_details
for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_fulfillment_details.order_id and o.customer_id = (select auth.uid()))
);
drop policy if exists order_fulfillment_staff_read on public.order_fulfillment_details;
create policy order_fulfillment_staff_read on public.order_fulfillment_details
for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_fulfillment_details.order_id and public.is_store_member(o.store_id))
);

drop policy if exists delivery_tracking_customer_read on public.order_delivery_tracking;
create policy delivery_tracking_customer_read on public.order_delivery_tracking
for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_delivery_tracking.order_id and o.customer_id = (select auth.uid()))
);
drop policy if exists delivery_tracking_staff_read on public.order_delivery_tracking;
create policy delivery_tracking_staff_read on public.order_delivery_tracking
for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_delivery_tracking.order_id and public.is_store_member(o.store_id))
);

drop policy if exists payment_transactions_customer_read on public.payment_transactions;
create policy payment_transactions_customer_read on public.payment_transactions
for select to authenticated using (
  exists (select 1 from public.orders o where o.id = payment_transactions.order_id and o.customer_id = (select auth.uid()))
);
drop policy if exists payment_transactions_staff_read on public.payment_transactions;
create policy payment_transactions_staff_read on public.payment_transactions
for select to authenticated using (
  exists (select 1 from public.orders o where o.id = payment_transactions.order_id and public.is_store_member(o.store_id))
);

revoke all on table public.store_fulfillment_settings, public.store_media, public.customer_store_views,
  public.order_fulfillment_details, public.order_delivery_tracking, public.payment_transactions
  from anon, authenticated;
grant select on table public.store_fulfillment_settings, public.store_media, public.order_fulfillment_details,
  public.order_delivery_tracking, public.payment_transactions to authenticated;
revoke all on table public.order_events from anon, authenticated;
grant select on table public.order_events to authenticated;
grant all privileges on table public.order_events to service_role;
grant select, insert, update, delete on table public.customer_store_views to authenticated;
grant all privileges on table public.store_fulfillment_settings, public.store_media, public.customer_store_views,
  public.order_fulfillment_details, public.order_delivery_tracking, public.payment_transactions to service_role;

create or replace function private.sync_order_lifecycle_timestamps()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'preparing' then new.preparing_at := coalesce(new.preparing_at, now()); end if;
    if new.status = 'ready_for_collection' then new.ready_at := coalesce(new.ready_at, now()); end if;
    if new.status = 'out_for_delivery' then new.out_for_delivery_at := coalesce(new.out_for_delivery_at, now()); end if;
    if new.status = 'cancelled' then new.cancelled_at := coalesce(new.cancelled_at, now()); end if;
    if new.status = 'refunded' then new.refunded_at := coalesce(new.refunded_at, now()); end if;
    if new.status = 'collected' then
      new.collected_at := coalesce(new.collected_at, now());
      new.completed_at := coalesce(new.completed_at, now());
    end if;
    if new.status = 'delivered' then
      new.delivered_at := coalesce(new.delivered_at, now());
      new.completed_at := coalesce(new.completed_at, now());
    end if;
    if new.status = 'completed' then
      new.completed_at := coalesce(new.completed_at, now());
      if new.fulfillment_type = 'delivery' then new.delivered_at := coalesce(new.delivered_at, now());
      else new.collected_at := coalesce(new.collected_at, now()); end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_order_lifecycle_timestamps() from public;
drop trigger if exists orders_sync_lifecycle_timestamps on public.orders;
create trigger orders_sync_lifecycle_timestamps
before update of status on public.orders
for each row execute function private.sync_order_lifecycle_timestamps();

create or replace function public.record_customer_store_view(p_customer_user_id uuid, p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_customer_user_id is null or p_store_id is null then
    raise exception using errcode = '22023', message = 'Store view request is invalid.';
  end if;
  if not exists (select 1 from public.customer_profiles where user_id = p_customer_user_id and status = 'active') then
    raise exception using errcode = '42501', message = 'Customer account is not active.';
  end if;
  if not exists (
    select 1 from public.stores s where s.id = p_store_id
      and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  ) then
    raise exception using errcode = '23503', message = 'Store is unavailable.';
  end if;
  insert into public.customer_store_views(user_id, store_id)
  values (p_customer_user_id, p_store_id)
  on conflict (user_id, store_id) do update
  set last_viewed_at = now(), view_count = customer_store_views.view_count + 1;
end;
$$;

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
    from public.cart_items ci where ci.cart_id = v_cart.id
    group by ci.product_id order by ci.product_id
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

create or replace function public.cancel_customer_order(p_order_id uuid, p_customer_user_id uuid, p_reason text default null)
returns table(order_number text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_order public.orders%rowtype; v_item record; v_stock record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.customer_id <> p_customer_user_id then
    raise exception using errcode = '42501', message = 'Order access denied.';
  end if;
  if v_order.status not in ('pending','placed') then
    raise exception using errcode = '23514', message = 'This order can no longer be cancelled.';
  end if;
  for v_item in select * from public.order_items where order_id = v_order.id order by product_id
  loop
    select * into v_stock from public.inventory_stock
    where store_id = v_order.store_id and product_id = v_item.product_id for update;
    if not found or v_stock.reserved_quantity < v_item.quantity then
      raise exception using errcode = '23514', message = 'Reserved inventory is unavailable.';
    end if;
    update public.inventory_stock set current_quantity = current_quantity + v_item.quantity,
      reserved_quantity = reserved_quantity - v_item.quantity, last_updated_by = p_customer_user_id
    where id = v_stock.id and reserved_quantity >= v_item.quantity;
    insert into public.inventory_movements(store_id, product_id, order_id, movement_type, quantity_changed,
      previous_quantity, new_quantity, reservation_quantity_changed, previous_reserved_quantity,
      new_reserved_quantity, reason, created_by)
    values (v_order.store_id, v_item.product_id, v_order.id, 'order_released', v_item.quantity,
      v_stock.current_quantity, v_stock.current_quantity + v_item.quantity, -v_item.quantity,
      v_stock.reserved_quantity, v_stock.reserved_quantity - v_item.quantity,
      'Customer cancelled order', p_customer_user_id);
  end loop;
  update public.orders set status = 'cancelled', cancelled_at = now(),
    cancellation_reason = left(nullif(btrim(p_reason), ''), 500), updated_at = now()
  where id = v_order.id;
  insert into public.order_events(order_id, store_id, actor_user_id, event_type, reason)
  values (v_order.id, v_order.store_id, p_customer_user_id, 'cancelled', left(nullif(btrim(p_reason), ''), 500));
  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (p_customer_user_id, 'customer_order_cancelled', 'orders', v_order.id, v_order.store_id,
    'success', jsonb_build_object('orderNumber', v_order.order_number));
  order_number := v_order.order_number; return next;
end;
$$;

create or replace function public.advance_customer_order(
  p_order_id uuid,
  p_actor_user_id uuid,
  p_next_status text
)
returns table(order_number text, order_status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_order public.orders%rowtype; v_actor_store_id uuid;
begin
  if p_next_status not in ('preparing','ready_for_collection','out_for_delivery','delivered') then
    raise exception using errcode = '22023', message = 'Order transition is invalid.';
  end if;
  select sp.store_id into v_actor_store_id from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.auth_user_id, sp.user_id) = p_actor_user_id
    and sp.role in ('manager','receptionist')
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  limit 1;
  if v_actor_store_id is null then raise exception using errcode = '42501', message = 'Staff access denied.'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.store_id <> v_actor_store_id then raise exception using errcode = '42501', message = 'Order access denied.'; end if;
  if not (
    (p_next_status = 'preparing' and v_order.status in ('pending','placed')) or
    (p_next_status = 'ready_for_collection' and v_order.fulfillment_type = 'collection' and v_order.status = 'preparing') or
    (p_next_status = 'out_for_delivery' and v_order.fulfillment_type = 'delivery' and v_order.status = 'preparing') or
    (p_next_status = 'delivered' and v_order.fulfillment_type = 'delivery' and v_order.status = 'out_for_delivery')
  ) then raise exception using errcode = '23514', message = 'Order cannot move to the requested status.'; end if;
  update public.orders set status = p_next_status, updated_at = now() where id = v_order.id;
  insert into public.order_events(order_id, store_id, actor_user_id, event_type)
  values (v_order.id, v_order.store_id, p_actor_user_id, p_next_status);
  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (p_actor_user_id, 'staff_advanced_customer_order', 'orders', v_order.id, v_order.store_id,
    'success', jsonb_build_object('from', v_order.status, 'to', p_next_status));
  order_number := v_order.order_number; order_status := p_next_status; return next;
end;
$$;

create or replace function public.forfeit_customer_collection_order(p_order_id uuid, p_actor_user_id uuid)
returns table(order_number text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_order public.orders%rowtype; v_actor_store_id uuid; v_item record; v_stock record;
begin
  select sp.store_id into v_actor_store_id from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.auth_user_id, sp.user_id) = p_actor_user_id and sp.role = 'manager'
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  limit 1;
  if v_actor_store_id is null then raise exception using errcode = '42501', message = 'Manager access denied.'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.store_id <> v_actor_store_id then raise exception using errcode = '42501', message = 'Order access denied.'; end if;
  if v_order.fulfillment_type <> 'collection' or v_order.status not in ('pending','placed','preparing','ready_for_collection') then
    raise exception using errcode = '23514', message = 'Order is not eligible for forfeiture.';
  end if;
  if v_order.collection_expires_at is null or now() < v_order.collection_expires_at then
    raise exception using errcode = '23514', message = 'Collection order has not expired.';
  end if;
  for v_item in select * from public.order_items where order_id = v_order.id order by product_id
  loop
    select * into v_stock from public.inventory_stock
    where store_id = v_order.store_id and product_id = v_item.product_id for update;
    if not found or v_stock.reserved_quantity < v_item.quantity then raise exception using errcode = '23514', message = 'Reserved inventory is unavailable.'; end if;
    update public.inventory_stock set current_quantity = current_quantity + v_item.quantity,
      reserved_quantity = reserved_quantity - v_item.quantity, last_updated_by = p_actor_user_id
    where id = v_stock.id and reserved_quantity >= v_item.quantity;
    insert into public.inventory_movements(store_id, product_id, order_id, movement_type, quantity_changed,
      previous_quantity, new_quantity, reservation_quantity_changed, previous_reserved_quantity,
      new_reserved_quantity, reason, created_by)
    values (v_order.store_id, v_item.product_id, v_order.id, 'order_released', v_item.quantity,
      v_stock.current_quantity, v_stock.current_quantity + v_item.quantity, -v_item.quantity,
      v_stock.reserved_quantity, v_stock.reserved_quantity - v_item.quantity,
      'Expired collection order released', p_actor_user_id);
  end loop;
  update public.orders set status = 'forfeited', forfeited_at = now(),
    forfeited_by_user_id = p_actor_user_id, updated_at = now() where id = v_order.id;
  insert into public.order_events(order_id, store_id, actor_user_id, event_type)
  values (v_order.id, v_order.store_id, p_actor_user_id, 'collection_expired'),
         (v_order.id, v_order.store_id, p_actor_user_id, 'forfeited');
  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (p_actor_user_id, 'manager_forfeited_expired_customer_order', 'orders', v_order.id,
    v_order.store_id, 'success', jsonb_build_object('orderNumber', v_order.order_number));
  order_number := v_order.order_number; return next;
end;
$$;

revoke all on function public.record_customer_store_view(uuid, uuid) from public, anon, authenticated;
revoke all on function public.place_customer_order_v2(uuid, uuid, text, jsonb, text, uuid) from public, anon, authenticated;
revoke all on function public.cancel_customer_order(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.advance_customer_order(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.forfeit_customer_collection_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_customer_store_view(uuid, uuid) to service_role;
grant execute on function public.place_customer_order_v2(uuid, uuid, text, jsonb, text, uuid) to service_role;
grant execute on function public.cancel_customer_order(uuid, uuid, text) to service_role;
grant execute on function public.advance_customer_order(uuid, uuid, text) to service_role;
grant execute on function public.forfeit_customer_collection_order(uuid, uuid) to service_role;
alter function public.record_customer_store_view(uuid, uuid) owner to postgres;
alter function public.place_customer_order_v2(uuid, uuid, text, jsonb, text, uuid) owner to postgres;
alter function public.cancel_customer_order(uuid, uuid, text) owner to postgres;
alter function public.advance_customer_order(uuid, uuid, text) owner to postgres;
alter function public.forfeit_customer_collection_order(uuid, uuid) owner to postgres;
