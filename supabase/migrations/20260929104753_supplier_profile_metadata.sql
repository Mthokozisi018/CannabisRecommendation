alter table public.suppliers
  add column if not exists description text,
  add column if not exists logo_bucket text,
  add column if not exists logo_path text,
  add column if not exists logo_url text,
  add column if not exists street_address text,
  add column if not exists suburb text,
  add column if not exists city text,
  add column if not exists postal_code text,
  add column if not exists payment_terms text,
  add column if not exists minimum_order_amount numeric(14, 2),
  add column if not exists delivery_time_days text;

alter table public.suppliers
  drop constraint if exists suppliers_minimum_order_amount_check;

alter table public.suppliers
  add constraint suppliers_minimum_order_amount_check
  check (minimum_order_amount is null or minimum_order_amount >= 0);

alter table public.suppliers
  drop constraint if exists suppliers_logo_storage_check;

alter table public.suppliers
  add constraint suppliers_logo_storage_check check (
    (logo_bucket is null and logo_path is null and logo_url is null)
    or (
      logo_bucket = 'product-images'
      and logo_path like ('stores/' || store_id::text || '/suppliers/%')
      and logo_url is not null
    )
  );
