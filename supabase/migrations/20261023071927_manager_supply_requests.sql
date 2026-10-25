begin;

-- Managers must not read central balances, costs or Realtime product payloads.
drop policy master_product_read on public.master_supply_products;
create policy master_product_read on public.master_supply_products for select to authenticated
  using (franchise_id = (select private.current_franchise_id()));
alter table public.master_supply_requests add column rejection_reason text not null default ''
  check (length(rejection_reason) <= 500);

-- Definer code is private and bound to auth.uid(), never caller-supplied IDs.
create function private.manager_supply_context()
returns table(store_id uuid, store_name text, franchise_id uuid, franchise_name text)
language sql stable security definer set search_path = pg_catalog, public as $$
  select st.id, st.name, f.id, f.name
  from public.staff_profiles sp
  join public.stores st on st.id=sp.store_id
  join public.franchises f on f.id=st.franchise_id
  where sp.auth_user_id=(select auth.uid()) and sp.role='manager'
    and sp.is_active and sp.account_status='active' and sp.account_setup_complete
    and st.is_active and st.store_access_status='active'
    and exists(select 1 from public.staff_profiles fa where fa.franchise_id=f.id
      and fa.role='franchise_admin' and fa.is_active and fa.account_status='active' and fa.account_setup_complete);
$$;
revoke all on function private.manager_supply_context() from public,anon,authenticated;
grant execute on function private.manager_supply_context() to authenticated;
create function public.manager_supply_context()
returns table(store_id uuid, store_name text, franchise_id uuid, franchise_name text)
language sql stable security invoker set search_path = pg_catalog, public as $$
  select * from private.manager_supply_context();
$$;
revoke all on function public.manager_supply_context() from public,anon,authenticated;
grant execute on function public.manager_supply_context() to authenticated;

create function private.manager_supply_catalogue()
returns table(id uuid, sku text, name text, category text, subcategory text,
  strain_type text, cultivation_type text, image_url text, available boolean)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if not exists(select 1 from private.manager_supply_context()) then
    raise exception 'Franchise store manager access required.' using errcode='42501';
  end if;
  return query select p.id,p.sku,p.name,p.category,p.subcategory,p.strain_type,p.cultivation_type,p.image_url,
    (p.on_hand > p.reserved)
    from public.master_supply_products p
    join private.manager_supply_context() c on c.franchise_id=p.franchise_id
    order by p.name,p.id;
end $$;
revoke all on function private.manager_supply_catalogue() from public,anon,authenticated;
grant execute on function private.manager_supply_catalogue() to authenticated;
create function public.manager_supply_catalogue()
returns table(id uuid, sku text, name text, category text, subcategory text,
  strain_type text, cultivation_type text, image_url text, available boolean)
language sql stable security invoker set search_path = pg_catalog, public as $$
  select * from private.manager_supply_catalogue();
$$;
revoke all on function public.manager_supply_catalogue() from public,anon,authenticated;
grant execute on function public.manager_supply_catalogue() to authenticated;

-- Keep the existing stock/distribution implementation, including its locks and
-- exactly-once deductions. Harden request submission and add review reasons.
alter function public.master_supply_mutation(uuid,text,jsonb) set schema private;
alter function private.master_supply_mutation(uuid,text,jsonb) rename to master_supply_mutation_core;
revoke all on function private.master_supply_mutation_core(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.master_supply_mutation_core(uuid,text,jsonb) to service_role;
create function public.master_supply_mutation(p_actor uuid,p_action text,p_data jsonb)
returns uuid language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  v_id uuid; v_store uuid; v_franchise uuid; v_item jsonb; v_product uuid;
  v_existing public.master_supply_requests%rowtype; v_seen uuid[] := '{}';
  v_notes text; v_qty numeric; v_reason text;
begin
  if p_action='request' then
    select st.id,st.franchise_id into v_store,v_franchise
      from public.staff_profiles sp join public.stores st on st.id=sp.store_id
      where sp.auth_user_id=p_actor and sp.role='manager' and sp.is_active
        and sp.account_status='active' and sp.account_setup_complete and st.is_active
        and st.store_access_status='active' and st.franchise_id is not null
        and exists(select 1 from public.staff_profiles fa where fa.franchise_id=st.franchise_id
          and fa.role='franchise_admin' and fa.is_active and fa.account_status='active' and fa.account_setup_complete)
      for share of sp,st;
    if v_store is null then raise exception 'Franchise store manager access required.' using errcode='42501'; end if;
    if p_data ? 'expectedStoreId' and (p_data->>'expectedStoreId')::uuid is distinct from v_store then
      raise exception 'Active store changed. Reload your request.' using errcode='42501';
    end if;
    if jsonb_typeof(p_data->'items') is distinct from 'array' then raise exception 'Select products.'; end if;
    if jsonb_array_length(p_data->'items') not between 1 and 100 then raise exception 'Select up to 100 products.'; end if;
    v_notes:=btrim(coalesce(p_data->>'notes',''));
    if length(v_notes)>500 then raise exception 'Notes must be 500 characters or fewer.'; end if;
    v_id:=(p_data->>'id')::uuid;
    if v_id is null then raise exception 'A request key is required.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_id::text,0));
    select * into v_existing from public.master_supply_requests where id=v_id;
    -- Validate all lines before idempotency comparisons or inserting anything.
    for v_item in select * from jsonb_array_elements(p_data->'items') loop
      v_product:=(v_item->>'productId')::uuid;
      if v_product is null or v_product=any(v_seen) then raise exception 'Select each product once.'; end if;
      v_seen:=array_append(v_seen,v_product);
      if jsonb_typeof(v_item->'quantity') is distinct from 'number' then raise exception 'Use positive whole requested quantities.'; end if;
      v_qty:=(v_item->>'quantity')::numeric;
      if v_qty<1 or v_qty>1000000 or trunc(v_qty)<>v_qty then raise exception 'Use positive whole requested quantities.'; end if;
    end loop;
    if v_existing.id is not null then
      if v_existing.store_id<>v_store or v_existing.franchise_id<>v_franchise or v_existing.requested_by<>p_actor
        or v_existing.notes<>v_notes or (select count(*) from public.master_supply_request_items where request_id=v_id)<>jsonb_array_length(p_data->'items')
        or exists(select 1 from jsonb_array_elements(p_data->'items') i where not exists(
          select 1 from public.master_supply_request_items ri where ri.request_id=v_id
            and ri.product_id=(i->>'productId')::uuid and ri.requested_quantity=(i->>'quantity')::integer)) then
        raise exception 'Request key was already used. Reload your request.';
      end if;
      return v_id;
    end if;
    -- Lock in deterministic product order; requests never reserve or deduct.
    for v_product in select unnest(v_seen) order by 1 loop
      perform 1 from public.master_supply_products where id=v_product and franchise_id=v_franchise and on_hand>reserved for share;
      if not found then raise exception 'A selected product is unavailable. Refresh the catalogue.'; end if;
    end loop;
    v_id:=private.master_supply_mutation_core(p_actor,p_action,jsonb_set(p_data,'{notes}',to_jsonb(v_notes)));
    return v_id;
  end if;
  if p_action='review_request' then
    v_reason:=btrim(coalesce(p_data->>'rejectionReason',''));
    if length(v_reason)>500 then raise exception 'Review reason must be 500 characters or fewer.'; end if;
    if p_data->>'decision'='reject' and v_reason='' then raise exception 'Enter a rejection reason.'; end if;
  end if;
  v_id:=private.master_supply_mutation_core(p_actor,p_action,p_data);
  if p_action='review_request' then
    update public.master_supply_requests set rejection_reason=case when p_data->>'decision'='reject' then v_reason else '' end where id=v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.master_supply_mutation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.master_supply_mutation(uuid,text,jsonb) to service_role;
commit;
