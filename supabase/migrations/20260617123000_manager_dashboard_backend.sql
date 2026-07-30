create extension if not exists pgcrypto;

insert into public.stores (id, slug, name)
values ('00000000-0000-4000-8000-000000000001', 'greenchoice-main', 'GreenChoice Sandton')
on conflict (id) do nothing;

alter table public.staff_profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists first_name text,
  add column if not exists surname text,
  add column if not exists mobile_number text,
  add column if not exists physical_address text,
  add column if not exists account_status text default 'active',
  add column if not exists deleted_at timestamptz;

update public.staff_profiles
set
  user_id = coalesce(user_id, auth_user_id),
  account_status = coalesce(account_status, case when is_active then 'active' else 'deactivated' end),
  first_name = coalesce(first_name, split_part(full_name, ' ', 1)),
  surname = coalesce(surname, nullif(trim(regexp_replace(full_name, '^\S+\s*', '')), ''))
where user_id is null or account_status is null or first_name is null or surname is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'staff_profiles_account_status_check') then
    alter table public.staff_profiles
      add constraint staff_profiles_account_status_check check (account_status in ('active','deactivated','deleted'));
  end if;
end $$;

create unique index if not exists staff_profiles_user_id_uidx on public.staff_profiles(user_id);
create index if not exists staff_profiles_account_status_idx on public.staff_profiles(account_status);

insert into public.categories (id, slug, name, sort_order, is_active)
values
  ('20000000-0000-4000-8000-000000000101', 'flower', 'Flower', 1, true),
  ('20000000-0000-4000-8000-000000000102', 'vape-cartridges', 'Vape Cartridges', 2, true),
  ('20000000-0000-4000-8000-000000000103', 'edibles', 'Edibles', 3, true),
  ('20000000-0000-4000-8000-000000000104', 'concentrates', 'Concentrates', 4, true),
  ('20000000-0000-4000-8000-000000000105', 'pre-rolls', 'Pre-Rolls', 5, true),
  ('20000000-0000-4000-8000-000000000106', 'beverages', 'Beverages', 6, true),
  ('20000000-0000-4000-8000-000000000107', 'accessories', 'Accessories', 7, true)
on conflict (id) do nothing;

alter table public.products
  add column if not exists product_name text,
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists cultivation_type text,
  add column if not exists price numeric(12,2),
  add column if not exists product_status text default 'active',
  add column if not exists image_bucket text,
  add column if not exists image_path text,
  add column if not exists image_url text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists deleted_at timestamptz;

update public.products
set
  product_name = coalesce(product_name, name),
  category = coalesce(category, facet_values->>'managerCategory'),
  subcategory = coalesce(subcategory, subcategory_slug),
  cultivation_type = case when coalesce(category, facet_values->>'managerCategory') = 'Flower' then coalesce(cultivation_type, grow_type) else null end,
  price = coalesce(price, price_cents::numeric / 100),
  product_status = coalesce(product_status, case when is_published then 'active' else 'inactive' end)
where product_name is null or price is null or product_status is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_manager_status_check') then
    alter table public.products add constraint products_manager_status_check check (product_status in ('active','inactive'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_manager_cultivation_check') then
    alter table public.products add constraint products_manager_cultivation_check check (
      (category = 'Flower' and cultivation_type in ('Indoor','Greenhouse','Outdoor'))
      or (category is distinct from 'Flower' and cultivation_type is null)
      or category is null
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_manager_category_check') then
    alter table public.products add constraint products_manager_category_check check (
      category is null or category in ('Flower','Vape Cartridges','Edibles','Concentrates','Pre-Rolls','Beverages','Accessories')
    );
  end if;
end $$;

create table if not exists public.inventory_stock (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  current_quantity numeric(12,2) not null default 0 check (current_quantity >= 0),
  low_stock_threshold numeric(12,2) not null default 5 check (low_stock_threshold >= 0),
  last_updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  movement_type text not null check (movement_type in ('initial_stock','stock_added','stock_removed','manual_adjustment','correction')),
  quantity_changed numeric(12,2) not null,
  previous_quantity numeric(12,2) not null check (previous_quantity >= 0),
  new_quantity numeric(12,2) not null check (new_quantity >= 0),
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists inventory_stock_touch_updated_at on public.inventory_stock;
create trigger inventory_stock_touch_updated_at
before update on public.inventory_stock
for each row execute function public.touch_updated_at();

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create or replace function public.is_greenchoice_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where coalesce(sp.user_id, sp.auth_user_id) = auth.uid()
      and sp.role = 'manager'
      and coalesce(sp.account_status, case when sp.is_active then 'active' else 'deactivated' end) = 'active'
  );
$$;

alter table public.inventory_stock enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists manager_products_select on public.products;
create policy manager_products_select on public.products for select using (public.is_greenchoice_manager());
drop policy if exists manager_products_insert on public.products;
create policy manager_products_insert on public.products for insert with check (public.is_greenchoice_manager());
drop policy if exists manager_products_update on public.products;
create policy manager_products_update on public.products for update using (public.is_greenchoice_manager()) with check (public.is_greenchoice_manager());

drop policy if exists manager_inventory_stock_select on public.inventory_stock;
create policy manager_inventory_stock_select on public.inventory_stock for select using (public.is_greenchoice_manager());
drop policy if exists manager_inventory_stock_insert on public.inventory_stock;
create policy manager_inventory_stock_insert on public.inventory_stock for insert with check (public.is_greenchoice_manager());
drop policy if exists manager_inventory_stock_update on public.inventory_stock;
create policy manager_inventory_stock_update on public.inventory_stock for update using (public.is_greenchoice_manager()) with check (public.is_greenchoice_manager());

drop policy if exists manager_inventory_movements_select on public.inventory_movements;
create policy manager_inventory_movements_select on public.inventory_movements for select using (public.is_greenchoice_manager());
drop policy if exists manager_inventory_movements_insert on public.inventory_movements;
create policy manager_inventory_movements_insert on public.inventory_movements for insert with check (public.is_greenchoice_manager());

drop policy if exists manager_audit_logs_select on public.audit_logs;
create policy manager_audit_logs_select on public.audit_logs for select using (public.is_greenchoice_manager());
drop policy if exists manager_audit_logs_insert on public.audit_logs;
create policy manager_audit_logs_insert on public.audit_logs for insert with check (public.is_greenchoice_manager());

drop policy if exists product_images_storage_manager_read on storage.objects;
create policy product_images_storage_manager_read on storage.objects for select using (bucket_id = 'product-images' and auth.uid() is not null);
drop policy if exists product_images_storage_manager_write on storage.objects;
create policy product_images_storage_manager_write on storage.objects for insert with check (bucket_id = 'product-images' and public.is_greenchoice_manager());

grant select, insert, update on table public.products to authenticated;
grant select, insert, update on table public.inventory_stock to authenticated;
grant select, insert on table public.inventory_movements to authenticated;
grant select, insert on table public.audit_logs to authenticated;
grant all privileges on table public.products, public.inventory_stock, public.inventory_movements, public.audit_logs, public.staff_profiles to service_role;
