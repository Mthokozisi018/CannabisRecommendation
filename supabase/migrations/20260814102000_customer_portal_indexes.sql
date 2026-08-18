-- Cover customer favourite foreign keys for store and product deletion/join paths.
create index if not exists customer_favourites_store_id_idx
  on public.customer_favourites(store_id)
  where store_id is not null;

create index if not exists customer_favourites_product_id_idx
  on public.customer_favourites(product_id)
  where product_id is not null;
