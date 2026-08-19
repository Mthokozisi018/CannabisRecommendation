-- GreenChoice store customer records and customer-linked receptionist sales.
-- POS customers are intentionally separate from customer_profiles: customer_profiles
-- represents authenticated/KYC customer accounts, while POS customer records are
-- lightweight in-store records requiring only name, surname and cellphone number.

create table if not exists public.pos_customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(btrim(first_name)) between 1 and 80),
  surname text not null check (char_length(btrim(surname)) between 1 and 80),
  phone_number text not null,
  portal_user_id uuid unique references public.customer_profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_customers_phone_normalized check (phone_number ~ '^\+27[0-9]{9}$'),
  constraint pos_customers_phone_unique unique (phone_number)
);

create table if not exists public.store_customer_registrations (
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.pos_customers(id) on delete cascade,
  registered_by_user_id uuid references auth.users(id) on delete set null,
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (store_id, customer_id)
);

alter table public.pos_sales
  add column if not exists customer_id uuid references public.pos_customers(id) on delete restrict;

create index if not exists store_customer_registrations_store_registered_idx
  on public.store_customer_registrations(store_id, registered_at desc);
create index if not exists store_customer_registrations_customer_idx
  on public.store_customer_registrations(customer_id);
create index if not exists pos_customers_name_lookup_idx
  on public.pos_customers(lower(first_name), lower(surname));
create index if not exists pos_sales_store_created_customer_idx
  on public.pos_sales(store_id, created_at desc, customer_id);

alter table public.pos_customers enable row level security;
alter table public.store_customer_registrations enable row level security;

revoke all on table public.pos_customers from public, anon, authenticated;
revoke all on table public.store_customer_registrations from public, anon, authenticated;
grant select, insert, update on table public.pos_customers to service_role;
grant select, insert, update, delete on table public.store_customer_registrations to service_role;

create or replace function public.search_store_pos_customers(
  p_auth_user_id uuid,
  p_mode text,
  p_query text,
  p_limit integer default 8
)
returns table(
  customer_id uuid,
  first_name text,
  surname text,
  phone_number text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_store_id uuid;
  v_query text := btrim(coalesce(p_query, ''));
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 20);
begin
  if p_auth_user_id is null or p_mode not in ('phone', 'name') or char_length(v_query) < 2 then
    raise exception using errcode = '22023', message = 'Invalid customer search.';
  end if;

  select sp.store_id
  into v_store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.auth_user_id, sp.user_id) = p_auth_user_id
    and sp.role in ('manager', 'receptionist')
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  limit 1;

  if v_store_id is null then
    raise exception using errcode = '42501', message = 'Customer search access denied.';
  end if;

  return query
  select c.id, c.first_name, c.surname, c.phone_number
  from public.store_customer_registrations scr
  join public.pos_customers c on c.id = scr.customer_id
  where scr.store_id = v_store_id
    and (
      (p_mode = 'phone' and regexp_replace(c.phone_number, '[^0-9]', '', 'g') ilike '%' || regexp_replace(v_query, '[^0-9]', '', 'g') || '%')
      or
      (p_mode = 'name' and (c.first_name || ' ' || c.surname) ilike '%' || v_query || '%')
    )
  order by scr.last_seen_at desc, c.first_name, c.surname
  limit v_limit;
end;
$$;

revoke all on function public.search_store_pos_customers(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.search_store_pos_customers(uuid, text, text, integer) to service_role;
alter function public.search_store_pos_customers(uuid, text, text, integer) owner to postgres;

create or replace function public.register_store_pos_customer(
  p_auth_user_id uuid,
  p_first_name text,
  p_surname text,
  p_phone_number text
)
returns table(
  customer_id uuid,
  first_name text,
  surname text,
  phone_number text,
  newly_registered_to_store boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_store_id uuid;
  v_customer_id uuid;
  v_first_name text;
  v_surname text;
  v_existing_registration boolean := false;
begin
  if p_auth_user_id is null
     or char_length(btrim(coalesce(p_first_name, ''))) not between 1 and 80
     or char_length(btrim(coalesce(p_surname, ''))) not between 1 and 80
     or btrim(coalesce(p_phone_number, '')) !~ '^\+27[0-9]{9}$' then
    raise exception using errcode = '22023', message = 'Customer details are invalid.';
  end if;

  select sp.store_id
  into v_store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.auth_user_id, sp.user_id) = p_auth_user_id
    and sp.role in ('manager', 'receptionist')
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  limit 1;

  if v_store_id is null then
    raise exception using errcode = '42501', message = 'Customer registration access denied.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(btrim(p_phone_number), 0));

  select c.id, c.first_name, c.surname
  into v_customer_id, v_first_name, v_surname
  from public.pos_customers c
  where c.phone_number = btrim(p_phone_number)
  for update;

  if v_customer_id is null then
    insert into public.pos_customers(first_name, surname, phone_number)
    values (btrim(p_first_name), btrim(p_surname), btrim(p_phone_number))
    returning id, pos_customers.first_name, pos_customers.surname
    into v_customer_id, v_first_name, v_surname;
  end if;

  select exists (
    select 1
    from public.store_customer_registrations scr
    where scr.store_id = v_store_id
      and scr.customer_id = v_customer_id
  ) into v_existing_registration;

  insert into public.store_customer_registrations(
    store_id, customer_id, registered_by_user_id, registered_at, last_seen_at
  )
  values (
    v_store_id, v_customer_id, p_auth_user_id, statement_timestamp(), statement_timestamp()
  )
  on conflict (store_id, customer_id) do update
    set last_seen_at = greatest(public.store_customer_registrations.last_seen_at, excluded.last_seen_at);

  if not v_existing_registration then
    insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
    values (
      p_auth_user_id,
      'receptionist_registered_pos_customer',
      'pos_customers',
      v_customer_id,
      v_store_id,
      'created',
      jsonb_build_object('phoneLastFour', right(btrim(p_phone_number), 4))
    );
  end if;

  customer_id := v_customer_id;
  first_name := v_first_name;
  surname := v_surname;
  phone_number := btrim(p_phone_number);
  newly_registered_to_store := not v_existing_registration;
  return next;
end;
$$;

revoke all on function public.register_store_pos_customer(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.register_store_pos_customer(uuid, text, text, text) to service_role;
alter function public.register_store_pos_customer(uuid, text, text, text) owner to postgres;

create or replace function public.complete_receptionist_sale_v3(
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
  v_store_id uuid;
  v_sale_id uuid;
  v_subtotal numeric;
  v_total numeric;
  v_already_completed boolean;
  v_existing_customer_id uuid;
begin
  if p_customer_id is null then
    raise exception using errcode = '22023', message = 'A customer must be selected before checkout.';
  end if;

  select sp.store_id
  into v_store_id
  from public.staff_profiles sp
  join public.stores s on s.id = sp.store_id
  where coalesce(sp.auth_user_id, sp.user_id) = p_auth_user_id
    and sp.role in ('manager', 'receptionist')
    and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
    and coalesce(s.store_access_status, case when s.is_active then 'active' else 'restricted' end) = 'active'
  limit 1;

  if v_store_id is null then
    raise exception using errcode = '42501', message = 'Checkout access denied.';
  end if;

  if not exists (
    select 1
    from public.store_customer_registrations scr
    where scr.store_id = v_store_id
      and scr.customer_id = p_customer_id
  ) then
    raise exception using errcode = '42501', message = 'Selected customer is not registered with this store.';
  end if;

  select ps.customer_id
  into v_existing_customer_id
  from public.pos_sales ps
  where ps.checkout_id = p_checkout_id;

  if v_existing_customer_id is not null and v_existing_customer_id <> p_customer_id then
    raise exception using errcode = '42501', message = 'Checkout customer does not match the completed sale.';
  end if;

  select r.sale_id, r.subtotal, r.total, r.already_completed
  into v_sale_id, v_subtotal, v_total, v_already_completed
  from public.complete_receptionist_sale_v2(p_checkout_id, p_auth_user_id, p_items) r;

  update public.pos_sales
  set customer_id = p_customer_id
  where id = v_sale_id
    and store_id = v_store_id
    and (customer_id is null or customer_id = p_customer_id);

  if not found then
    raise exception using errcode = '42501', message = 'Checkout customer could not be linked.';
  end if;

  update public.store_customer_registrations
  set last_seen_at = statement_timestamp()
  where store_id = v_store_id
    and customer_id = p_customer_id;

  insert into public.audit_logs(user_id, action, table_name, record_id, store_id, result, details)
  values (
    p_auth_user_id,
    'receptionist_linked_customer_to_pos_sale',
    'pos_sales',
    v_sale_id,
    v_store_id,
    'completed',
    jsonb_build_object('customerId', p_customer_id)
  );

  sale_id := v_sale_id;
  subtotal := v_subtotal;
  total := v_total;
  already_completed := v_already_completed;
  return next;
end;
$$;

revoke all on function public.complete_receptionist_sale_v3(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_receptionist_sale_v3(uuid, uuid, uuid, jsonb) to service_role;
alter function public.complete_receptionist_sale_v3(uuid, uuid, uuid, jsonb) owner to postgres;

comment on table public.pos_customers is
  'Lightweight customer identities used for receptionist POS sales; globally de-duplicated by normalized cellphone number.';
comment on table public.store_customer_registrations is
  'Store-scoped customer membership used for POS lookup and manager customer totals.';
comment on function public.complete_receptionist_sale_v3(uuid, uuid, uuid, jsonb) is
  'Completes the existing atomic POS sale flow and requires a store-registered customer to be linked to the sale in the same transaction.';
