-- GreenChoice customer portal: customer accounts, preferences, saved items,
-- customer-safe catalog access, and server-validated draft carts.

create schema if not exists private;
revoke all on schema private from public;

alter table public.stores
  add column if not exists public_description text,
  add column if not exists logo_url text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists opening_hours jsonb not null default '{}'::jsonb;

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 80),
  surname text not null check (char_length(surname) between 1 and 80),
  email text not null,
  phone_number text not null,
  id_fingerprint text not null,
  id_last_four text not null check (id_last_four ~ '^[0-9]{4}$'),
  date_of_birth date not null,
  age_verified_at timestamptz not null,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'active', 'suspended', 'erasure_requested', 'deleted')),
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  terms_version text not null,
  terms_accepted_at timestamptz not null,
  privacy_policy_version text not null,
  privacy_policy_accepted_at timestamptz not null,
  physical_id_notice_accepted_at timestamptz not null,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_profiles_email_normalized check (email = lower(btrim(email))),
  constraint customer_profiles_phone_normalized check (phone_number ~ '^\+27[0-9]{9}$'),
  constraint customer_profiles_email_unique unique (email),
  constraint customer_profiles_phone_unique unique (phone_number),
  constraint customer_profiles_id_fingerprint_unique unique (id_fingerprint)
);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  label text not null default 'Home' check (char_length(label) between 1 and 40),
  street_address text not null check (char_length(street_address) between 3 and 180),
  unit_details text check (unit_details is null or char_length(unit_details) <= 100),
  suburb text not null check (char_length(suburb) between 1 and 100),
  city text not null check (char_length(city) between 1 and 100),
  province text not null check (province in ('Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape')),
  postal_code text not null check (postal_code ~ '^[0-9]{4}$'),
  country text not null default 'South Africa' check (country = 'South Africa'),
  latitude double precision,
  longitude double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_addresses_one_default
  on public.customer_addresses(user_id) where is_default;

create table if not exists public.customer_preferences (
  user_id uuid primary key references public.customer_profiles(user_id) on delete cascade,
  favourite_categories text[] not null default '{}',
  default_radius_km integer not null default 15 check (default_radius_km between 1 and 100),
  open_now_only boolean not null default false,
  appearance text not null default 'system' check (appearance in ('light', 'dark', 'system')),
  language text not null default 'en-ZA',
  email_notifications boolean not null default true,
  sms_notifications boolean not null default true,
  promotional_notifications boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_favourites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint customer_favourites_one_target check (num_nonnulls(store_id, product_id) = 1)
);

create unique index if not exists customer_favourites_store_unique
  on public.customer_favourites(user_id, store_id) where store_id is not null;
create unique index if not exists customer_favourites_product_unique
  on public.customer_favourites(user_id, product_id) where product_id is not null;

create table if not exists public.customer_support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  category text not null check (category in ('account', 'technical', 'store', 'privacy', 'other')),
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  consent_type text not null check (consent_type in ('terms', 'privacy', 'physical_id_notice', 'marketing')),
  policy_version text not null,
  accepted boolean not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, consent_type, policy_version)
);

create or replace function private.touch_customer_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_customer_updated_at() from public;

drop trigger if exists customer_profiles_touch_updated_at on public.customer_profiles;
create trigger customer_profiles_touch_updated_at before update on public.customer_profiles
for each row execute function private.touch_customer_updated_at();

drop trigger if exists customer_addresses_touch_updated_at on public.customer_addresses;
create trigger customer_addresses_touch_updated_at before update on public.customer_addresses
for each row execute function private.touch_customer_updated_at();

drop trigger if exists customer_preferences_touch_updated_at on public.customer_preferences;
create trigger customer_preferences_touch_updated_at before update on public.customer_preferences
for each row execute function private.touch_customer_updated_at();

drop trigger if exists customer_support_requests_touch_updated_at on public.customer_support_requests;
create trigger customer_support_requests_touch_updated_at before update on public.customer_support_requests
for each row execute function private.touch_customer_updated_at();

create or replace function private.is_active_customer()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.customer_profiles cp
    where cp.user_id = (select auth.uid())
      and cp.status = 'active'
  );
$$;

revoke all on function private.is_active_customer() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_active_customer() to authenticated;

alter table public.customer_profiles enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.customer_preferences enable row level security;
alter table public.customer_favourites enable row level security;
alter table public.customer_support_requests enable row level security;
alter table public.customer_consents enable row level security;

drop policy if exists customer_profiles_self_select on public.customer_profiles;
create policy customer_profiles_self_select on public.customer_profiles
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists customer_profiles_self_update on public.customer_profiles;
create policy customer_profiles_self_update on public.customer_profiles
for update to authenticated
using ((select auth.uid()) = user_id and status in ('pending_verification', 'active'))
with check ((select auth.uid()) = user_id and status in ('pending_verification', 'active'));

drop policy if exists customer_addresses_self_all on public.customer_addresses;
create policy customer_addresses_self_all on public.customer_addresses
for all to authenticated
using ((select auth.uid()) = user_id and private.is_active_customer())
with check ((select auth.uid()) = user_id and private.is_active_customer());

drop policy if exists customer_preferences_self_all on public.customer_preferences;
create policy customer_preferences_self_all on public.customer_preferences
for all to authenticated
using ((select auth.uid()) = user_id and private.is_active_customer())
with check ((select auth.uid()) = user_id and private.is_active_customer());

drop policy if exists customer_favourites_self_all on public.customer_favourites;
create policy customer_favourites_self_all on public.customer_favourites
for all to authenticated
using ((select auth.uid()) = user_id and private.is_active_customer())
with check ((select auth.uid()) = user_id and private.is_active_customer());

drop policy if exists customer_support_self_select on public.customer_support_requests;
create policy customer_support_self_select on public.customer_support_requests
for select to authenticated using ((select auth.uid()) = user_id and private.is_active_customer());

drop policy if exists customer_support_self_insert on public.customer_support_requests;
create policy customer_support_self_insert on public.customer_support_requests
for insert to authenticated with check ((select auth.uid()) = user_id and private.is_active_customer());

drop policy if exists customer_consents_self_select on public.customer_consents;
create policy customer_consents_self_select on public.customer_consents
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists carts_customer_read on public.carts;
create policy carts_customer_read on public.carts
for select to authenticated
using ((select auth.uid()) = created_by_user_id and private.is_active_customer());

drop policy if exists cart_items_customer_read on public.cart_items;
create policy cart_items_customer_read on public.cart_items
for select to authenticated
using (
  private.is_active_customer()
  and exists (
    select 1 from public.carts c
    where c.id = cart_items.cart_id and c.created_by_user_id = (select auth.uid())
  )
);

revoke select on public.customer_profiles from authenticated;
grant select (user_id, first_name, surname, email, phone_number, id_last_four, date_of_birth, status, email_verified_at, phone_verified_at, marketing_consent, terms_version, terms_accepted_at, privacy_policy_version, privacy_policy_accepted_at, created_at, updated_at)
  on public.customer_profiles to authenticated;
revoke update on public.customer_profiles from authenticated;
grant update (first_name, surname, phone_number, marketing_consent) on public.customer_profiles to authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;
grant select, insert, update, delete on public.customer_preferences to authenticated;
grant select, insert, delete on public.customer_favourites to authenticated;
grant select, insert on public.customer_support_requests to authenticated;
grant select on public.customer_consents to authenticated;
grant select on public.carts, public.cart_items to authenticated;

create index if not exists customer_addresses_user_id_idx on public.customer_addresses(user_id);
create index if not exists customer_favourites_user_id_idx on public.customer_favourites(user_id);
create index if not exists customer_support_requests_user_id_created_at_idx on public.customer_support_requests(user_id, created_at desc);
create index if not exists carts_customer_draft_idx on public.carts(created_by_user_id, updated_at desc) where status = 'draft';
