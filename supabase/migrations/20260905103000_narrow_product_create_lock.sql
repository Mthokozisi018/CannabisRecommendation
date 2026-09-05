-- Keep duplicate protection atomic without locking the entire store row.
-- This migration is intentionally branch-only until it is validated in staging.

create or replace function public.create_product_with_inventory(
  p_store_id uuid,
  p_product_name text,
  p_category text,
  p_subcategory text,
  p_cultivation_type text,
  p_price numeric,
  p_product_status text,
  p_package_count integer,
  p_thc_per_unit_mg numeric,
  p_thc_per_packet_mg numeric,
  p_initial_stock integer,
  p_low_stock_threshold integer
)
returns table(product_id uuid, current_quantity integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_store_id uuid;
  v_product_id uuid;
  v_category_id uuid;
  v_slug text;
  v_is_vape boolean;
  v_facet_values jsonb;
  v_duplicate_lock_key text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  if public.is_greenchoice_admin() then
    select s.id into v_store_id
    from public.stores s
    where s.id = p_store_id
      and s.store_access_status = 'active'
      and s.is_active is not false;
  elsif public.is_greenchoice_manager() then
    select public.current_staff_store_id() into v_store_id;
    if p_store_id is not null and p_store_id is distinct from v_store_id then
      raise exception using errcode = '42501', message = 'not_authorized';
    end if;
  end if;

  if v_store_id is null then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  if nullif(btrim(p_product_name), '') is null
    or char_length(btrim(p_product_name)) > 160
    or nullif(btrim(p_subcategory), '') is null
    or char_length(btrim(p_subcategory)) > 120
    or p_category not in ('Flower', 'Pre-Rolls', 'Edibles', 'Accessories', 'Vape Cartridges', 'Disposable Vapes', 'Concentrates', 'Beverages')
    or p_product_status not in ('active', 'inactive')
    or p_price is null
    or p_price < 0
    or p_price > 1000000
    or p_initial_stock is null
    or p_initial_stock < 0
    or p_initial_stock > 1000000
    or p_low_stock_threshold is null
    or p_low_stock_threshold < 0
    or p_low_stock_threshold > 1000000
    or (p_package_count is not null and (p_package_count < 1 or p_package_count > 100000))
    or (p_thc_per_unit_mg is not null and (p_thc_per_unit_mg < 0 or p_thc_per_unit_mg > 100000))
    or (p_thc_per_packet_mg is not null and (p_thc_per_packet_mg < 0 or p_thc_per_packet_mg > 1000000))
  then
    raise exception using errcode = '22023', message = 'invalid_product';
  end if;

  -- The old function locked the stores row, which serialized every product
  -- creation for the same store. Lock only the normalized duplicate identity
  -- instead so different products can be created concurrently while two
  -- identical creates still cannot race past the duplicate check.
  v_duplicate_lock_key := concat_ws(
    '|',
    v_store_id::text,
    lower(btrim(p_product_name)),
    p_category,
    p_subcategory,
    coalesce(nullif(btrim(p_cultivation_type), ''), '<null>')
  );
  perform pg_advisory_xact_lock(hashtextextended(v_duplicate_lock_key, 0));

  if exists (
    select 1
    from public.products p
    where p.store_id = v_store_id
      and lower(p.product_name) = lower(btrim(p_product_name))
      and p.category = p_category
      and p.subcategory = p_subcategory
      and p.cultivation_type is not distinct from nullif(btrim(p_cultivation_type), '')
      and p.deleted_at is null
  ) then
    raise exception using errcode = '23505', message = 'duplicate_product';
  end if;

  v_category_id := case p_category
    when 'Flower' then '20000000-0000-4000-8000-000000000101'::uuid
    when 'Vape Cartridges' then '20000000-0000-4000-8000-000000000102'::uuid
    when 'Edibles' then '20000000-0000-4000-8000-000000000103'::uuid
    when 'Concentrates' then '20000000-0000-4000-8000-000000000104'::uuid
    when 'Pre-Rolls' then '20000000-0000-4000-8000-000000000105'::uuid
    when 'Beverages' then '20000000-0000-4000-8000-000000000106'::uuid
    when 'Accessories' then '20000000-0000-4000-8000-000000000107'::uuid
    when 'Disposable Vapes' then '20000000-0000-4000-8000-000000000108'::uuid
  end;

  v_slug := trim(both '-' from regexp_replace(lower(btrim(p_product_name)), '[^a-z0-9]+', '-', 'g'))
    || '-' || substr(gen_random_uuid()::text, 1, 8);
  v_is_vape := p_category = 'Vape Cartridges';
  v_facet_values := jsonb_build_object(
    'managerCategory', p_category,
    'managerSubcategory', p_subcategory,
    'cultivationType', coalesce(nullif(btrim(p_cultivation_type), ''), '')
  );

  if v_is_vape then
    v_facet_values := v_facet_values || jsonb_build_object(
      'vapeProductType', p_subcategory,
      'vapeStrainType', coalesce(nullif(btrim(p_cultivation_type), ''), '')
    );
  end if;

  if p_category = 'Edibles' and p_package_count is not null then
    v_facet_values := v_facet_values || jsonb_build_object('packageCount', p_package_count);
  end if;

  insert into public.products (
    store_id,
    category_id,
    subcategory_slug,
    slug,
    name,
    brand,
    strain_type,
    grow_type,
    price_cents,
    is_published,
    stock_status,
    facet_values,
    product_name,
    category,
    subcategory,
    cultivation_type,
    price,
    product_status,
    is_visible_on_pos,
    created_by,
    thc_per_unit_mg,
    thc_per_packet_mg
  )
  values (
    v_store_id,
    v_category_id,
    p_subcategory,
    v_slug,
    btrim(p_product_name),
    btrim(p_product_name),
    case
      when v_is_vape then nullif(btrim(p_cultivation_type), '')
      when p_category in ('Flower', 'Pre-Rolls') then p_subcategory
      else null
    end,
    nullif(btrim(p_cultivation_type), ''),
    round(p_price * 100)::integer,
    p_product_status = 'active',
    'in_stock',
    v_facet_values,
    btrim(p_product_name),
    p_category,
    p_subcategory,
    nullif(btrim(p_cultivation_type), ''),
    p_price,
    p_product_status,
    true,
    v_user_id,
    case when p_category = 'Edibles' then p_thc_per_unit_mg else null end,
    case when p_category = 'Edibles' then p_thc_per_packet_mg else null end
  )
  returning id into v_product_id;

  insert into public.inventory_stock (
    store_id,
    product_id,
    current_quantity,
    low_stock_threshold,
    last_updated_by
  )
  values (
    v_store_id,
    v_product_id,
    p_initial_stock,
    p_low_stock_threshold,
    v_user_id
  );

  if p_initial_stock > 0 then
    insert into public.inventory_movements (
      store_id,
      product_id,
      movement_type,
      quantity_changed,
      previous_quantity,
      new_quantity,
      reason,
      created_by
    )
    values (
      v_store_id,
      v_product_id,
      'initial_stock',
      p_initial_stock,
      0,
      p_initial_stock,
      'Initial stock on product creation',
      v_user_id
    );
  end if;

  insert into public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    store_id,
    result,
    details
  )
  values (
    v_user_id,
    'product_created_with_inventory',
    'products',
    v_product_id,
    v_store_id,
    'success',
    jsonb_build_object(
      'category', p_category,
      'subcategory', p_subcategory,
      'initialStock', p_initial_stock
    )
  );

  return query select v_product_id, p_initial_stock;
end;
$$;

alter function public.create_product_with_inventory(uuid, text, text, text, text, numeric, text, integer, numeric, numeric, integer, integer) owner to postgres;
revoke all on function public.create_product_with_inventory(uuid, text, text, text, text, numeric, text, integer, numeric, numeric, integer, integer) from public, anon;
grant execute on function public.create_product_with_inventory(uuid, text, text, text, text, numeric, text, integer, numeric, numeric, integer, integer) to authenticated;
