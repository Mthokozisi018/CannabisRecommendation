insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-images', 'store-images', true, 6291456, array['image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.store_media
  add column if not exists storage_bucket text,
  add column if not exists storage_path text;

alter table public.stores
  add column if not exists store_image_bucket text,
  add column if not exists store_image_path text,
  add column if not exists store_image_url text;

create or replace function public.validate_store_image_reference()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_expected_prefix text;
begin
  if new.store_image_bucket is null and new.store_image_path is null and new.store_image_url is null then
    return new;
  end if;

  if new.store_image_bucket is distinct from 'store-images' then
    raise exception using errcode = '23514', message = 'invalid_store_image_bucket';
  end if;

  v_expected_prefix := format('stores/%s/cover/', new.id);
  if new.store_image_path is null
    or new.store_image_path not like v_expected_prefix || '%'
    or new.store_image_path like '%..%'
    or new.store_image_path like '%\%'
  then
    raise exception using errcode = '23514', message = 'invalid_store_image_reference';
  end if;

  if new.store_image_url is null
    or new.store_image_url like '%store-image-coming-soon.png%'
    or char_length(new.store_image_url) > 2048
  then
    raise exception using errcode = '23514', message = 'invalid_store_image_url';
  end if;

  return new;
end;
$$;

drop trigger if exists stores_validate_store_image_reference on public.stores;
create trigger stores_validate_store_image_reference
before insert or update of store_image_bucket, store_image_path, store_image_url
on public.stores
for each row
execute function public.validate_store_image_reference();

create or replace function public.validate_store_media_image_reference()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_expected_prefix text;
begin
  if new.storage_bucket is null and new.storage_path is null then
    return new;
  end if;

  if new.storage_bucket is distinct from 'store-images' then
    raise exception using errcode = '23514', message = 'invalid_store_image_bucket';
  end if;

  if new.media_type <> 'cover' then
    raise exception using errcode = '23514', message = 'invalid_store_image_media_type';
  end if;

  v_expected_prefix := format('stores/%s/cover/', new.store_id);
  if new.storage_path is null
    or new.storage_path not like v_expected_prefix || '%'
    or new.storage_path like '%..%'
    or new.storage_path like '%\%'
  then
    raise exception using errcode = '23514', message = 'invalid_store_image_reference';
  end if;

  return new;
end;
$$;

drop trigger if exists store_media_validate_image_reference on public.store_media;
create trigger store_media_validate_image_reference
before insert or update of store_id, media_type, storage_bucket, storage_path
on public.store_media
for each row
execute function public.validate_store_media_image_reference();

comment on function public.validate_store_media_image_reference() is
  'Ensures manager-uploaded store media references stay under the trusted store cover prefix. Local placeholders are visual-only and are never stored here.';

comment on function public.validate_store_image_reference() is
  'Ensures stores.store_image_url points to a manager-uploaded store-images object and never to the visual placeholder.';
