drop policy if exists manager_products_select on public.products;
create policy manager_products_select on public.products for select using (
  public.is_greenchoice_manager()
  and public.is_store_access_active(store_id)
);

drop policy if exists manager_products_insert on public.products;
create policy manager_products_insert on public.products for insert with check (
  public.is_greenchoice_manager()
  and public.is_store_access_active(store_id)
);

drop policy if exists manager_products_update on public.products;
create policy manager_products_update on public.products for update using (
  public.is_greenchoice_manager()
  and public.is_store_access_active(store_id)
) with check (
  public.is_greenchoice_manager()
  and public.is_store_access_active(store_id)
);

drop policy if exists products_member_read on public.products;
create policy products_member_read on public.products for select using (
  public.is_store_member(store_id)
  and public.is_store_access_active(store_id)
);

drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products for all using (
  public.has_store_role(store_id, array['admin','catalog_manager'])
  and public.is_store_access_active(store_id)
) with check (
  public.has_store_role(store_id, array['admin','catalog_manager'])
  and public.is_store_access_active(store_id)
);

drop policy if exists inventory_member_read on public.inventory_items;
create policy inventory_member_read on public.inventory_items for select using (
  public.is_store_member(store_id)
  and public.is_store_access_active(store_id)
);

drop policy if exists inventory_admin_write on public.inventory_items;
create policy inventory_admin_write on public.inventory_items for all using (
  public.has_store_role(store_id, array['admin','catalog_manager'])
  and public.is_store_access_active(store_id)
) with check (
  public.has_store_role(store_id, array['admin','catalog_manager'])
  and public.is_store_access_active(store_id)
);

drop policy if exists manager_inventory_stock_select on public.inventory_stock;
create policy manager_inventory_stock_select on public.inventory_stock for select using (
  public.is_greenchoice_manager()
  and exists (
    select 1 from public.products p
    where p.id = product_id
      and public.is_store_access_active(p.store_id)
  )
);

drop policy if exists manager_inventory_stock_insert on public.inventory_stock;
create policy manager_inventory_stock_insert on public.inventory_stock for insert with check (
  public.is_greenchoice_manager()
  and exists (
    select 1 from public.products p
    where p.id = product_id
      and public.is_store_access_active(p.store_id)
  )
);

drop policy if exists manager_inventory_stock_update on public.inventory_stock;
create policy manager_inventory_stock_update on public.inventory_stock for update using (
  public.is_greenchoice_manager()
  and exists (
    select 1 from public.products p
    where p.id = product_id
      and public.is_store_access_active(p.store_id)
  )
) with check (
  public.is_greenchoice_manager()
  and exists (
    select 1 from public.products p
    where p.id = product_id
      and public.is_store_access_active(p.store_id)
  )
);

drop policy if exists manager_inventory_movements_select on public.inventory_movements;
create policy manager_inventory_movements_select on public.inventory_movements for select using (
  public.is_greenchoice_manager()
  and exists (
    select 1 from public.products p
    where p.id = product_id
      and public.is_store_access_active(p.store_id)
  )
);

drop policy if exists manager_inventory_movements_insert on public.inventory_movements;
create policy manager_inventory_movements_insert on public.inventory_movements for insert with check (
  public.is_greenchoice_manager()
  and exists (
    select 1 from public.products p
    where p.id = product_id
      and public.is_store_access_active(p.store_id)
  )
);
