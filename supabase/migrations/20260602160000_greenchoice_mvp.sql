create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  currency_code text not null default 'ZAR',
  timezone text not null default 'Africa/Johannesburg',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin','receptionist','catalog_manager')),
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','receptionist','catalog_manager')),
  created_at timestamptz not null default now(),
  unique(store_id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete restrict,
  slug text unique not null,
  name text not null,
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.effects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  icon text,
  sort_order int not null default 0
);

create table public.terpenes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text
);

create table public.flavors (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  subcategory_slug text not null,
  slug text unique not null,
  name text not null,
  brand text,
  strain_type text,
  grow_type text,
  genetics_summary text,
  best_time_of_use text,
  description text not null,
  price_cents int not null check (price_cents >= 0),
  size_label text,
  rating_avg numeric,
  rating_count int,
  thc_value numeric,
  thc_unit text,
  cbd_value numeric,
  cbd_unit text,
  terpene_total_pct numeric,
  is_lab_tested boolean not null default false,
  is_on_special boolean not null default false,
  is_new boolean not null default false,
  is_published boolean not null default true,
  stock_status text not null default 'in_stock' check (stock_status in ('in_stock','low_stock','out_of_stock')),
  facet_values jsonb not null default '{}',
  search_tsv tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  sort_order int not null default 0,
  is_primary boolean not null default false
);

create table public.product_effect_scores (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  effect_id uuid not null references public.effects(id) on delete cascade,
  score_pct int not null check (score_pct between 0 and 100),
  unique(product_id, effect_id)
);

create table public.product_terpenes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  terpene_id uuid not null references public.terpenes(id) on delete cascade,
  pct numeric,
  rank_order int,
  unique(product_id, terpene_id)
);

create table public.product_flavors (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  flavor_id uuid not null references public.flavors(id) on delete cascade,
  unique(product_id, flavor_id)
);

create table public.product_lineage (
  id uuid primary key default gen_random_uuid(),
  child_product_id uuid not null references public.products(id) on delete cascade,
  parent_product_id uuid not null references public.products(id) on delete restrict,
  relation_type text not null
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  on_hand_qty int not null default 0,
  reserved_qty int not null default 0,
  availability_status text not null default 'available',
  updated_at timestamptz not null default now(),
  unique(store_id, product_id)
);

create table public.recommendation_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  selected_effect_id uuid not null references public.effects(id) on delete restrict,
  created_by_user_id uuid references auth.users(id) on delete set null,
  search_query text,
  filters_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  recommendation_session_id uuid references public.recommendation_sessions(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','saved')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cart_id, product_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index idx_products_store_category on public.products(store_id, category_id);
create index idx_products_store_stock on public.products(store_id, stock_status);
create index idx_products_facet_values on public.products using gin (facet_values);
create index idx_products_search_tsv on public.products using gin (search_tsv);
create index idx_products_name_trgm on public.products using gin (name gin_trgm_ops);
create index idx_products_brand_trgm on public.products using gin (brand gin_trgm_ops);
create index idx_inventory_store_product on public.inventory_items(store_id, product_id);
create index idx_carts_store_status on public.carts(store_id, status);
create index idx_cart_items_cart on public.cart_items(cart_id);
create index idx_effect_scores_product_effect on public.product_effect_scores(product_id, effect_id);

create or replace function public.products_search_tsv_update()
returns trigger language plpgsql as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.brand, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.strain_type, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'C');
  return new;
end;
$$;

create trigger products_search_tsv_trigger
before insert or update on public.products
for each row execute function public.products_search_tsv_update();

create or replace function public.is_store_member(target_store uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.store_memberships sm
    where sm.store_id = target_store and sm.user_id = auth.uid()
  );
$$;

create or replace function public.has_store_role(target_store uuid, roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.store_memberships sm
    where sm.store_id = target_store and sm.user_id = auth.uid() and sm.role = any(roles)
  );
$$;

alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.store_memberships enable row level security;
alter table public.categories enable row level security;
alter table public.effects enable row level security;
alter table public.terpenes enable row level security;
alter table public.flavors enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_effect_scores enable row level security;
alter table public.product_terpenes enable row level security;
alter table public.product_flavors enable row level security;
alter table public.product_lineage enable row level security;
alter table public.inventory_items enable row level security;
alter table public.recommendation_sessions enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.audit_events enable row level security;

create policy stores_member_read on public.stores for select using (public.is_store_member(id));
create policy profiles_self_read on public.profiles for select using (id = auth.uid());
create policy memberships_member_read on public.store_memberships for select using (public.is_store_member(store_id));

create policy taxonomy_staff_read on public.categories for select using (auth.uid() is not null);
create policy effects_staff_read on public.effects for select using (auth.uid() is not null);
create policy terpenes_staff_read on public.terpenes for select using (auth.uid() is not null);
create policy flavors_staff_read on public.flavors for select using (auth.uid() is not null);

create policy products_member_read on public.products for select using (public.is_store_member(store_id));
create policy products_admin_write on public.products for all using (public.has_store_role(store_id, array['admin','catalog_manager'])) with check (public.has_store_role(store_id, array['admin','catalog_manager']));
create policy inventory_member_read on public.inventory_items for select using (public.is_store_member(store_id));
create policy inventory_admin_write on public.inventory_items for all using (public.has_store_role(store_id, array['admin','catalog_manager'])) with check (public.has_store_role(store_id, array['admin','catalog_manager']));

create policy sessions_member_rw on public.recommendation_sessions for all using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy carts_member_rw on public.carts for all using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy cart_items_member_rw on public.cart_items for all using (
  exists(select 1 from public.carts c where c.id = cart_id and public.is_store_member(c.store_id))
) with check (
  exists(select 1 from public.carts c where c.id = cart_id and public.is_store_member(c.store_id))
);

create policy product_children_read_images on public.product_images for select using (
  exists(select 1 from public.products p where p.id = product_id and public.is_store_member(p.store_id))
);
create policy product_children_read_effects on public.product_effect_scores for select using (
  exists(select 1 from public.products p where p.id = product_id and public.is_store_member(p.store_id))
);
create policy product_children_read_terpenes on public.product_terpenes for select using (
  exists(select 1 from public.products p where p.id = product_id and public.is_store_member(p.store_id))
);
create policy product_children_read_flavors on public.product_flavors for select using (
  exists(select 1 from public.products p where p.id = product_id and public.is_store_member(p.store_id))
);
create policy product_lineage_read on public.product_lineage for select using (
  exists(select 1 from public.products p where p.id = child_product_id and public.is_store_member(p.store_id))
);

create policy audit_admin_read on public.audit_events for select using (public.has_store_role(store_id, array['admin']));
create policy audit_admin_insert on public.audit_events for insert with check (public.has_store_role(store_id, array['admin','catalog_manager']));

insert into storage.buckets (id, name, public)
values ('products', 'products', false)
on conflict (id) do nothing;

create policy product_images_storage_read on storage.objects for select using (
  bucket_id = 'products' and auth.uid() is not null
);
create policy product_images_storage_admin_write on storage.objects for insert with check (
  bucket_id = 'products' and exists (
    select 1 from public.store_memberships sm
    where sm.user_id = auth.uid() and sm.role in ('admin','catalog_manager')
  )
);
