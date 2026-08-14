update storage.buckets
set
  public = true,
  file_size_limit = 6291456,
  allowed_mime_types = array['image/webp']::text[]
where id = 'product-images';

drop policy if exists product_images_storage_manager_write on storage.objects;
drop policy if exists product_images_storage_manager_update on storage.objects;
drop policy if exists product_images_storage_manager_delete on storage.objects;

-- The legacy private `products` bucket has no current application writer. Keep
-- existing objects readable to authenticated users while removing direct writes.
drop policy if exists product_images_storage_admin_write on storage.objects;

create or replace function public.validate_product_image_reference()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_expected_prefix text;
begin
  if new.image_bucket is distinct from 'product-images' then
    return new;
  end if;

  v_expected_prefix := format('stores/%s/products/%s/', new.store_id, new.id);
  if new.image_path is null
    or new.image_path not like v_expected_prefix || '%'
    or new.image_path like '%..%'
    or new.image_path like '%\%'
  then
    raise exception using errcode = '23514', message = 'invalid_product_image_reference';
  end if;

  return new;
end;
$$;

drop trigger if exists products_validate_image_reference on public.products;
create trigger products_validate_image_reference
before insert or update of store_id, image_bucket, image_path
on public.products
for each row
execute function public.validate_product_image_reference();

comment on function public.validate_product_image_reference() is
  'Ensures product-images metadata remains under the immutable trusted store/product prefix.';
