begin;

-- Add a small, fictional read-only supply example to the existing demo
-- franchise. Never seed another tenant or duplicate a previously seeded set.
do $$
declare
  v_franchise uuid;
  v_store uuid;
  v_actor uuid;
  v_product uuid;
  v_request uuid;
begin
  select d.franchise_id, d.auth_user_id into v_franchise, v_actor
  from private.demo_franchise_accounts d
  join public.franchises f on f.id = d.franchise_id
  where f.name = 'DEMO - Fictional GreenChoice Franchise (Test Only)';

  if v_franchise is null then
    raise exception 'Demo franchise registry is missing or mismatched';
  end if;

  select s.id into v_store from public.stores s
  where s.franchise_id = v_franchise
    and s.name = 'DEMO - Fictional Store (Test Only)';
  if v_store is null then
    raise exception 'Demo franchise store is missing or mismatched';
  end if;

  if exists(select 1 from public.master_supply_products where franchise_id = v_franchise)
     or exists(select 1 from public.master_supply_requests where franchise_id = v_franchise) then
    raise exception 'Demo master supply already contains data; review before seeding';
  end if;

  insert into public.master_supply_products
    (franchise_id, sku, name, category, subcategory, price,
     supplier_cost_price, description, on_hand, total_received, last_received_at)
  values
    (v_franchise, 'DEMO-MASTER-DISPLAY-001',
     'DEMO - Fictional Display Item (Not For Sale)',
     'Accessories', 'Display', 95.00, 55.00,
     'Fictional central stock for demonstrating Master Supply. Not offered to customers.',
     18, 18, now() - interval '6 days')
  returning id into v_product;

  insert into public.master_supply_receipts
    (franchise_id, product_id, quantity, actor_id, reason, created_at)
  values
    (v_franchise, v_product, 18, v_actor,
     'Synthetic opening stock for the GreenChoice demo',
     now() - interval '6 days');

  v_request := gen_random_uuid();
  insert into public.master_supply_requests
    (id, franchise_id, store_id, requested_by, status, notes, created_at)
  values
    (v_request, v_franchise, v_store, v_actor, 'pending',
     'Synthetic request to demonstrate the franchise supply review workflow.',
     now() - interval '1 day');

  insert into public.master_supply_request_items
    (request_id, product_id, requested_quantity)
  values (v_request, v_product, 3);
end $$;

commit;
