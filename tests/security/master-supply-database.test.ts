import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const fa="10000000-0000-4000-8000-000000000001", manager="10000000-0000-4000-8000-000000000002", otherFa="10000000-0000-4000-8000-000000000003";
const otherManager="10000000-0000-4000-8000-000000000004", independentManager="10000000-0000-4000-8000-000000000005", siblingManager="10000000-0000-4000-8000-000000000006";
const franchise="20000000-0000-4000-8000-000000000001", otherFranchise="20000000-0000-4000-8000-000000000002";
const store="30000000-0000-4000-8000-000000000001", otherStore="30000000-0000-4000-8000-000000000002", independentStore="30000000-0000-4000-8000-000000000003", siblingStore="30000000-0000-4000-8000-000000000004";
const product="40000000-0000-4000-8000-000000000001", request="50000000-0000-4000-8000-000000000001", distribution="60000000-0000-4000-8000-000000000001";
let db:PGlite;
const mutate=(actor:string,action:string,data:Record<string,unknown>)=>db.query<{id:string}>("select public.master_supply_mutation($1,$2,$3) as id",[actor,action,JSON.stringify(data)]);

describe("Master Supply source and franchise boundaries",()=>{
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema private;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table auth.users(id uuid primary key);
      create table public.franchises(id uuid primary key,name text default 'Test franchise');
      create table public.stores(id uuid primary key,franchise_id uuid references franchises,is_active boolean default true,store_access_status text default 'active',name text);
      create table public.staff_profiles(auth_user_id uuid primary key references auth.users,role text,store_id uuid references stores,franchise_id uuid references franchises,is_active boolean,account_status text,account_setup_complete boolean);
      create table public.categories(id uuid primary key,name text,is_active boolean default true);
      create table public.products(id uuid primary key default gen_random_uuid(),store_id uuid references stores,category_id uuid references categories,subcategory_slug text,slug text unique,name text,description text,price_cents integer,
        product_name text,category text,subcategory text,cultivation_type text,strain_type text,price numeric,product_status text,image_url text,is_published boolean,deleted_at timestamptz,created_at timestamptz default now(),
        constraint product_cultivation_check check ((category in ('Flower','Pre-Rolls') and cultivation_type in ('Indoor','Greenhouse','Outdoor')) or (category='Vape Cartridges' and cultivation_type in ('Sativa','Indica','Hybrid')) or (category not in ('Flower','Pre-Rolls','Vape Cartridges') and cultivation_type is null) or category is null));
      create table public.inventory_stock(id uuid primary key default gen_random_uuid(),store_id uuid references stores,product_id uuid unique references products,current_quantity numeric not null default 0,last_updated_by uuid);
      create table public.inventory_movements(id uuid primary key default gen_random_uuid(),store_id uuid,product_id uuid,movement_type text,quantity_changed numeric,previous_quantity numeric,new_quantity numeric,reason text,created_by uuid);
      create table public.pos_sales(id uuid primary key default gen_random_uuid(),store_id uuid references stores,status text default 'completed',total numeric default 0,refunded_amount numeric default 0);
      create table public.pos_sale_items(id uuid primary key default gen_random_uuid(),sale_id uuid references pos_sales,product_id uuid references products,quantity integer);
      create function private.current_franchise_id() returns uuid language sql stable as $$select franchise_id from public.staff_profiles where auth_user_id=auth.uid() and role='franchise_admin'$$;
      create function public.current_staff_store_id() returns uuid language sql stable as $$select store_id from public.staff_profiles where auth_user_id=auth.uid()$$;
      grant usage on schema auth,private,public to authenticated,service_role;
      grant all on all tables in schema public to service_role;
      grant select on all tables in schema public to authenticated;
      insert into auth.users values('${fa}'),('${manager}'),('${otherFa}'),('${otherManager}'),('${independentManager}'),('${siblingManager}');
      insert into franchises(id) values('${franchise}'),('${otherFranchise}');
      insert into stores(id,franchise_id,name) values('${store}','${franchise}','A'),('${otherStore}','${otherFranchise}','B'),('${independentStore}',null,'Independent'),('${siblingStore}','${franchise}','Sibling');
      insert into staff_profiles values('${fa}','franchise_admin',null,'${franchise}',true,'active',true),('${manager}','manager','${store}',null,true,'active',true),('${otherFa}','franchise_admin',null,'${otherFranchise}',true,'active',true),('${otherManager}','manager','${otherStore}',null,true,'active',true),('${independentManager}','manager','${independentStore}',null,true,'active',true),('${siblingManager}','manager','${siblingStore}',null,true,'active',true);
      insert into categories values('70000000-0000-4000-8000-000000000001','Flower',true),('70000000-0000-4000-8000-000000000002','Pre-Rolls',true),('70000000-0000-4000-8000-000000000003','Vape Cartridges',true);
    `);
    await db.exec(readFileSync("supabase/migrations/20261019132156_master_supply.sql","utf8"));
    await db.exec(readFileSync("supabase/migrations/20261021185315_master_supply_product_cost.sql","utf8"));
    await db.exec(readFileSync("supabase/migrations/20261023071927_manager_supply_requests.sql","utf8"));
  },30000);
  afterAll(async()=>{await db?.close();});

  it("receives, reserves, dispatches, receives and attributes stock without counting supplier units",async()=>{
    await mutate(fa,"create_product",{id:product,sku:"GC-001",name:"Test Flower",category:"Flower",subcategory:"Flower",strainType:"Hybrid",cultivationType:"Indoor",price:50,description:"Test",quantity:20});
    await mutate(manager,"request",{id:request,items:[{productId:product,quantity:10}],notes:"Need stock"});
    await expect(mutate(fa,"create_product",{id:crypto.randomUUID(),sku:"GC-OTHER",name:"test flower",category:"Flower",subcategory:"flower",strainType:"hybrid",cultivationType:"Indoor",price:50,description:"Duplicate",quantity:1})).rejects.toThrow();
    await mutate(fa,"review_request",{requestId:request,decision:"approve",items:[]});
    await mutate(fa,"distribute",{id:distribution,storeId:store,requestId:request,deliveryMethod:"standard",notes:"",items:[{productId:product,quantity:10}]});
    expect((await db.query<{on_hand:number;reserved:number}>("select on_hand,reserved from master_supply_products where id=$1",[product])).rows[0]).toMatchObject({on_hand:20,reserved:10});
    await mutate(fa,"dispatch",{distributionId:distribution});
    expect((await db.query<{on_hand:number;reserved:number}>("select on_hand,reserved from master_supply_products where id=$1",[product])).rows[0]).toMatchObject({on_hand:10,reserved:0});
    await mutate(manager,"receive",{distributionId:distribution,items:[{productId:product,quantity:10}]});
    const source=(await db.query<{product_id:string;quantity:number}>("select product_id,quantity from master_supply_store_stock where store_id=$1",[store])).rows[0];
    expect(source.quantity).toBe(10);
    await db.query("update inventory_stock set current_quantity=current_quantity+5 where product_id=$1",[source.product_id]);
    const sale=(await db.query<{id:string}>("insert into pos_sales(store_id) values($1) returning id",[store])).rows[0];
    await db.query("insert into pos_sale_items(sale_id,product_id,quantity) values($1,$2,8)",[sale.id,source.product_id]);
    await db.query("update inventory_stock set current_quantity=current_quantity-8 where product_id=$1",[source.product_id]);
    const balance=(await db.query<{quantity:number;sold_total:number}>("select quantity,sold_total from master_supply_store_stock where store_id=$1",[store])).rows[0];
    expect(balance).toMatchObject({quantity:7,sold_total:3});
    await expect(db.query("delete from inventory_stock where product_id=$1",[source.product_id])).rejects.toThrow(/reconciled/i);
    expect((await db.query<{quantity:number}>("select quantity from master_supply_sale_allocations where sale_id=$1",[sale.id])).rows[0]?.quantity).toBe(3);
    await expect(mutate(fa,"distribute",{id:distribution,storeId:store,requestId:request,deliveryMethod:"standard",notes:"",items:[{productId:product,quantity:10}]})).resolves.toBeTruthy();
    expect((await db.query<{n:number}>("select count(*)::int as n from master_supply_distributions")).rows[0].n).toBe(1);
    await expect(mutate(otherFa,"add_stock",{id:crypto.randomUUID(),productId:product,quantity:1,reason:""})).rejects.toThrow();
  });

  it("limits authenticated reads to the actor's franchise",async()=>{
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${otherFa}',false);`);
    expect((await db.query("select id from master_supply_products")).rows).toHaveLength(0);
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${manager}',false);`);
    expect((await db.query("select id from master_supply_products")).rows).toHaveLength(0);
    expect((await db.query("select id from master_supply_requests")).rows).toHaveLength(1);
    expect((await db.query("select product_id,quantity from master_supply_distribution_items")).rows).toHaveLength(1);
    await db.exec("reset role;");
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${otherManager}',false);`);
    expect((await db.query("select id from master_supply_products")).rows).toHaveLength(0);
    expect((await db.query("select id from master_supply_distributions")).rows).toHaveLength(0);
    expect((await db.query("select product_id from master_supply_distribution_items")).rows).toHaveLength(0);
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${independentManager}',false);`);
    expect((await db.query("select id from master_supply_products")).rows).toHaveLength(0);
    await db.exec("reset role; set role anon;");
    await expect(db.query("select public.master_supply_mutation($1,'request','{}'::jsonb)",[manager])).rejects.toThrow();
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${siblingManager}',false);`);
    expect((await db.query("select id from master_supply_products")).rows).toHaveLength(0);
    expect((await db.query("select id from master_supply_requests")).rows).toHaveLength(0);
    expect((await db.query("select id from master_supply_distributions")).rows).toHaveLength(0);
    expect((await db.query("select product_id from master_supply_distribution_items")).rows).toHaveLength(0);
    expect((await db.query("select store_id from master_supply_store_stock")).rows).toHaveLength(0);
    await db.exec("reset role;");
  });

  it("rejects unauthorized changes, excess stock and duplicate receipt",async()=>{
    await expect(mutate(manager,"add_stock",{id:crypto.randomUUID(),productId:product,quantity:1,reason:""})).rejects.toThrow();
    await expect(mutate(independentManager,"request",{id:crypto.randomUUID(),items:[{productId:product,quantity:1}],notes:""})).rejects.toThrow();
    await expect(mutate(otherFa,"distribute",{id:crypto.randomUUID(),storeId:store,requestId:null,deliveryMethod:"standard",notes:"",items:[{productId:product,quantity:1}]})).rejects.toThrow();
    await expect(mutate(fa,"distribute",{id:crypto.randomUUID(),storeId:otherStore,requestId:null,deliveryMethod:"standard",notes:"",items:[{productId:product,quantity:1}]})).rejects.toThrow();
    await expect(mutate(fa,"distribute",{id:crypto.randomUUID(),storeId:store,requestId:null,deliveryMethod:"standard",notes:"",items:[{productId:product,quantity:999}]})).rejects.toThrow();
    await expect(mutate(manager,"receive",{distributionId:distribution,items:[{productId:product,quantity:10}]})).rejects.toThrow();
    const current=(await db.query<{on_hand:number;reserved:number}>("select on_hand,reserved from master_supply_products where id=$1",[product])).rows[0];
    expect(current).toMatchObject({on_hand:10,reserved:0});
    const receiptId=crypto.randomUUID();
    await mutate(fa,"add_stock",{id:receiptId,productId:product,quantity:2,reason:"Test receipt"});
    await mutate(fa,"add_stock",{id:receiptId,productId:product,quantity:2,reason:"Test receipt"});
    expect((await db.query<{on_hand:number}>("select on_hand from master_supply_products where id=$1",[product])).rows[0]?.on_hand).toBe(12);
  });

  it("records partial receipt as a discrepancy without crediting missing units",async()=>{
    const id=crypto.randomUUID();
    await mutate(fa,"distribute",{id,storeId:store,requestId:null,deliveryMethod:"collection",notes:"",items:[{productId:product,quantity:2}]});
    await mutate(fa,"dispatch",{distributionId:id});
    await mutate(manager,"receive",{distributionId:id,items:[{productId:product,quantity:1}]});
    expect((await db.query<{status:string}>("select status from master_supply_distributions where id=$1",[id])).rows[0]?.status).toBe("discrepancy");
    expect((await db.query<{quantity:number}>("select quantity from master_supply_store_stock where store_id=$1",[store])).rows[0]?.quantity).toBe(8);
    expect(Number((await db.query<{current_quantity:number}>("select current_quantity from inventory_stock where store_id=$1",[store])).rows[0]?.current_quantity)).toBe(8);
  });

  it("restocks only confirmed, fully refunded master units once",async()=>{
    const allocation=(await db.query<{sale_item_id:string;sale_id:string}>("select sale_item_id,sale_id from master_supply_sale_allocations limit 1")).rows[0];
    await db.query("update pos_sales set total=400,refunded_amount=400 where id=$1",[allocation.sale_id]);
    expect((await db.query<{n:number}>("select count(*)::int as n from master_supply_events where action='refund_changed' and target_id=$1",[allocation.sale_id])).rows[0]?.n).toBe(1);
    const id=crypto.randomUUID();
    const payload={id,saleItemId:allocation.sale_item_id,quantity:2,reason:"Sealed, inspected return",conditionConfirmed:true};
    await mutate(manager,"restock_refund",payload);
    await mutate(manager,"restock_refund",payload);
    expect((await db.query<{quantity:number}>("select quantity from master_supply_store_stock where store_id=$1",[store])).rows[0]?.quantity).toBe(10);
    expect(Number((await db.query<{current_quantity:number}>("select current_quantity from inventory_stock where store_id=$1",[store])).rows[0]?.current_quantity)).toBe(10);
    expect((await db.query<{n:number}>("select count(*)::int as n from master_supply_restocks")).rows[0]?.n).toBe(1);
    await expect(mutate(manager,"restock_refund",{...payload,id:crypto.randomUUID(),quantity:2})).rejects.toThrow();
    await expect(mutate(manager,"restock_refund",{...payload,id:crypto.randomUUID(),conditionConfirmed:false})).rejects.toThrow();
  });

  it("audits central corrections without changing total received",async()=>{
    const id=crypto.randomUUID();
    const payload={id,productId:product,delta:-1,reason:"Damaged during inspection"};
    await mutate(fa,"adjust_central",payload);
    await mutate(fa,"adjust_central",payload);
    expect((await db.query<{on_hand:number;total_received:number}>("select on_hand,total_received from master_supply_products where id=$1",[product])).rows[0]).toMatchObject({on_hand:9,total_received:22});
    expect((await db.query<{n:number}>("select count(*)::int as n from master_supply_adjustments")).rows[0]?.n).toBe(1);
    await expect(mutate(fa,"adjust_central",{id:crypto.randomUUID(),productId:product,delta:-10,reason:"Count correction"})).rejects.toThrow();
  });

  it("retains a partial fulfillment when received units are below approval",async()=>{
    const requestId=crypto.randomUUID(),distributionId=crypto.randomUUID();
    await mutate(manager,"request",{id:requestId,items:[{productId:product,quantity:4}],notes:"More stock"});
    await mutate(fa,"review_request",{requestId,decision:"partial",items:[{productId:product,quantity:2}]});
    expect((await db.query<{status:string}>("select status from master_supply_requests where id=$1",[requestId])).rows[0]?.status).toBe("partially_approved");
    await mutate(fa,"distribute",{id:distributionId,storeId:store,requestId,deliveryMethod:"standard",notes:"",items:[{productId:product,quantity:1}]});
    await mutate(fa,"dispatch",{distributionId});
    await mutate(manager,"receive",{distributionId,items:[{productId:product,quantity:1}]});
    expect((await db.query<{status:string}>("select status from master_supply_requests where id=$1",[requestId])).rows[0]?.status).toBe("partially_fulfilled");
  });

  it("keeps a published supplier product separate from the Master Supply POS listing",async()=>{
    const masterId=crypto.randomUUID(), supplierId=crypto.randomUUID(), distributionId=crypto.randomUUID();
    await db.query("insert into products(id,store_id,product_name,category,subcategory,strain_type,cultivation_type,is_published) values($1,$2,'Shared Flower','Flower','Flower','Hybrid','Indoor',true)",[supplierId,store]);
    await db.query("insert into inventory_stock(store_id,product_id,current_quantity) values($1,$2,3)",[store,supplierId]);
    await mutate(fa,"create_product",{id:masterId,sku:"GC-002",name:"Shared Flower",category:"Flower",subcategory:"Flower",strainType:"Hybrid",cultivationType:"Indoor",price:50,description:"Test",quantity:2});
    await mutate(fa,"distribute",{id:distributionId,storeId:store,requestId:null,deliveryMethod:"standard",notes:"",items:[{productId:masterId,quantity:2}]});
    await mutate(fa,"dispatch",{distributionId});
    await mutate(manager,"receive",{distributionId,items:[{productId:masterId,quantity:2}]});
    const linked=(await db.query<{product_id:string;product_name:string;is_published:boolean}>("select ss.product_id,p.product_name,p.is_published from master_supply_store_stock ss join products p on p.id=ss.product_id where ss.master_product_id=$1",[masterId])).rows[0];
    expect(linked.product_id).not.toBe(supplierId);
    expect(linked.product_name).toBe("Shared Flower (Master Supply)");
    expect(linked.is_published).toBe(false);
    expect(Number((await db.query<{current_quantity:number}>("select current_quantity from inventory_stock where product_id=$1",[supplierId])).rows[0].current_quantity)).toBe(3);
    await expect(db.query("update products set is_published=true where id=$1",[linked.product_id])).rejects.toThrow(/cannot be published/i);
  });

  it("receives Pre-Rolls and Vape Cartridges using the existing product constraints",async()=>{
    for (const [category,cultivation] of [["Pre-Rolls","Indoor"],["Vape Cartridges","Hybrid"]]) {
      const masterId=crypto.randomUUID(),distributionId=crypto.randomUUID();
      await mutate(fa,"create_product",{id:masterId,sku:crypto.randomUUID(),name:`Test ${category}`,category,subcategory:"",strainType:"Hybrid",cultivationType:cultivation,price:50,description:"Test",quantity:1});
      await mutate(fa,"distribute",{id:distributionId,storeId:store,requestId:null,deliveryMethod:"standard",notes:"",items:[{productId:masterId,quantity:1}]});
      await mutate(fa,"dispatch",{distributionId});
      await mutate(manager,"receive",{distributionId,items:[{productId:masterId,quantity:1}]});
      const product=(await db.query<{cultivation_type:string}>("select p.cultivation_type from master_supply_store_stock ss join products p on p.id=ss.product_id where ss.master_product_id=$1",[masterId])).rows[0];
      expect(product.cultivation_type).toBe(cultivation);
    }
  });
  it("saves supplier cost with the initial receipt atomically and enforces franchise access",async()=>{
    const id=crypto.randomUUID();
    const data={id,sku:"GC-MS-NEW-001",name:"New Master Flower",category:"Flower",subcategory:"Hybrid",strainType:"Hybrid",cultivationType:"Indoor",price:150,supplierCostPrice:82.5,imageUrl:"https://example.com/master.webp",description:"",quantity:12};
    const create=(actor:string,input:typeof data)=>db.query<{id:string}>("select public.master_supply_create_product_with_cost($1,$2) as id",[actor,JSON.stringify(input)]);
    await expect(create(manager,{...data,id:crypto.randomUUID(),sku:"GC-MS-MANAGER"})).rejects.toThrow();
    const invalidId=crypto.randomUUID();
    await expect(create(fa,{...data,id:invalidId,sku:"GC-MS-INVALID",supplierCostPrice:0})).rejects.toThrow();
    expect((await db.query<{count:number}>("select count(*)::int as count from master_supply_products where id=$1",[invalidId])).rows[0]?.count).toBe(0);
    await create(fa,data);
    const saved=(await db.query<{supplier_cost_price:string;price:string;image_url:string;on_hand:number}>("select supplier_cost_price,price,image_url,on_hand from master_supply_products where id=$1",[id])).rows[0];
    expect(Number(saved.supplier_cost_price)).toBe(82.5);
    expect(Number(saved.price)).toBe(150);
    expect(saved).toMatchObject({image_url:data.imageUrl,on_hand:12});
    expect((await db.query<{quantity:number}>("select quantity from master_supply_receipts where product_id=$1",[id])).rows[0]?.quantity).toBe(12);
    expect((await db.query<{count:number}>("select count(*)::int as count from master_supply_store_stock where master_product_id=$1",[id])).rows[0]?.count).toBe(0);
    await expect(mutate(otherFa,"add_stock",{id:crypto.randomUUID(),productId:id,quantity:1,reason:""})).rejects.toThrow();
    await expect(create(fa,{...data,id:crypto.randomUUID(),sku:"GC-MS-DUPLICATE"})).rejects.toThrow();
    expect((await db.query<{count:number}>("select count(*)::int as count from master_supply_products where franchise_id=$1 and lower(name)=lower($2)",[franchise,data.name])).rows[0]?.count).toBe(1);
  });
  it("returns an availability-only catalogue and denies balances, costs, foreign and independent access",async()=>{
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${manager}',false);`);
    const catalogue=await db.query<Record<string,unknown>>("select * from public.manager_supply_catalogue()");
    expect(catalogue.rows.length).toBeGreaterThan(0);
    expect(Object.keys(catalogue.rows[0]).sort()).toEqual(["id","sku","name","category","subcategory","strain_type","cultivation_type","image_url","available"].sort());
    expect(catalogue.rows.every(row=>typeof row.available==="boolean")).toBe(true);
    expect((await db.query("select on_hand,reserved,supplier_cost_price,total_received from master_supply_products")).rows).toHaveLength(0);
    const context=(await db.query<{store_id:string;franchise_id:string}>("select * from manager_supply_context()")).rows[0];
    expect(context).toMatchObject({store_id:store,franchise_id:franchise});
    await expect(db.query("select public.master_supply_mutation($1,'request','{}')",[manager])).rejects.toThrow(/permission denied/i);
    await expect(db.query("select private.master_supply_mutation_core($1,'request','{}')",[manager])).rejects.toThrow(/permission denied/i);
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${otherManager}',false);`);
    expect((await db.query("select * from manager_supply_catalogue()")).rows).toHaveLength(0);
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${independentManager}',false);`);
    expect((await db.query("select * from manager_supply_context()")).rows).toHaveLength(0);
    await expect(db.query("select * from manager_supply_catalogue()")).rejects.toThrow(/access required/i);
    await db.exec("reset role; set role anon;");
    await expect(db.query("select * from manager_supply_catalogue()")).rejects.toThrow(/permission denied/i);
    await db.exec("reset role;");
  });

  it("submits multiple products above availability without reserving stock and retries exactly once",async()=>{
    const second=crypto.randomUUID(),id=crypto.randomUUID();
    await mutate(fa,"create_product",{id:second,sku:"REQUEST-SECOND",name:"Request accessory",category:"Pre-Rolls",subcategory:"Hybrid",strainType:"Hybrid",cultivationType:"Indoor",price:30,quantity:2});
    const before=(await db.query("select id,on_hand,reserved from master_supply_products order by id")).rows;
    const payload={id,expectedStoreId:store,items:[{productId:product,quantity:999},{productId:second,quantity:300}],notes:"Please replenish both products"};
    const results=await Promise.all([mutate(manager,"request",payload),mutate(manager,"request",payload)]);
    expect(results[0].rows[0].id).toBe(results[1].rows[0].id);
    expect((await db.query("select id,on_hand,reserved from master_supply_products order by id")).rows).toEqual(before);
    expect((await db.query("select product_id from master_supply_request_items where request_id=$1",[id])).rows).toHaveLength(2);
    expect((await db.query<{status:string;requested_by:string}>("select status,requested_by from master_supply_requests where id=$1",[id])).rows[0]).toMatchObject({status:"pending",requested_by:manager});
    await expect(mutate(manager,"request",{...payload,notes:"Changed payload"})).rejects.toThrow(/key was already used/i);
    await expect(mutate(siblingManager,"request",{...payload,expectedStoreId:siblingStore})).rejects.toThrow(/key was already used/i);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${fa}',false);`);
    expect((await db.query("select id from master_supply_requests where id=$1",[id])).rows).toHaveLength(1);
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${siblingManager}',false);`);
    expect((await db.query("select id from master_supply_requests where id=$1",[id])).rows).toHaveLength(0);
    expect((await db.query("select product_id from master_supply_request_items where request_id=$1",[id])).rows).toHaveLength(0);
    await db.exec("reset role;");
    await mutate(fa,"review_request",{requestId:id,decision:"partial",items:[{productId:product,quantity:1},{productId:second,quantity:1}]});
    expect((await db.query("select id,on_hand,reserved from master_supply_products order by id")).rows).toEqual(before);
    const shipment=crypto.randomUUID();
    await mutate(fa,"distribute",{id:shipment,storeId:store,requestId:id,deliveryMethod:"standard",notes:"",items:[{productId:product,quantity:1},{productId:second,quantity:1}]});
    await expect(mutate(fa,"distribute",{id:crypto.randomUUID(),storeId:store,requestId:id,deliveryMethod:"standard",notes:"",items:[{productId:product,quantity:1}]})).rejects.toThrow(/already converted/i);
    await mutate(fa,"dispatch",{distributionId:shipment});
    await expect(mutate(fa,"dispatch",{distributionId:shipment})).rejects.toThrow();
    await mutate(manager,"receive",{distributionId:shipment,items:[{productId:product,quantity:1},{productId:second,quantity:1}]});
    await expect(mutate(manager,"receive",{distributionId:shipment,items:[{productId:product,quantity:1},{productId:second,quantity:1}]})).rejects.toThrow();
    expect((await db.query<{status:string}>("select status from master_supply_requests where id=$1",[id])).rows[0].status).toBe("fulfilled");
  });

  it("rolls back invalid and unavailable lines, rejects manipulated store and franchise IDs without balance errors",async()=>{
    const foreign=crypto.randomUUID(),empty=crypto.randomUUID();
    for(const [actor,id,qty] of [[otherFa,foreign,4],[fa,empty,0]] as const) await mutate(actor,"create_product",{id,sku:id,name:id,category:"Flower",subcategory:"Hybrid",strainType:"Hybrid",cultivationType:"Indoor",price:30,quantity:qty});
    const count=(await db.query<{n:number}>("select count(*)::int n from master_supply_requests")).rows[0].n;
    const invalid=[
      {items:[{productId:product,quantity:1},{productId:product,quantity:2}]},
      {items:[{productId:product,quantity:1.5}]}, {items:[{productId:product,quantity:0}]},
      {items:[{productId:product,quantity:-2}]}, {items:[{productId:product,quantity:"2"}]},
      {items:[{productId:product,quantity:1},{productId:foreign,quantity:1}]},
      {items:[{productId:empty,quantity:1}]},
      {expectedStoreId:siblingStore,items:[{productId:product,quantity:1}]},
    ];
    for(const input of invalid) await expect(mutate(manager,"request",{id:crypto.randomUUID(),expectedStoreId:store,notes:"",...input})).rejects.toThrow();
    expect((await db.query<{n:number}>("select count(*)::int n from master_supply_requests")).rows[0].n).toBe(count);
    const id=crypto.randomUUID();
    await mutate(manager,"request",{id,expectedStoreId:store,items:[{productId:product,quantity:1}],notes:"Store notes"});
    await expect(mutate(otherFa,"review_request",{requestId:id,decision:"approve",items:[]})).rejects.toThrow();
    await expect(mutate(fa,"review_request",{requestId:id,decision:"reject",items:[]})).rejects.toThrow(/rejection reason/i);
    const before=(await db.query("select on_hand,reserved from master_supply_products where id=$1",[product])).rows;
    await mutate(fa,"review_request",{requestId:id,decision:"reject",items:[],rejectionReason:"Product is being replaced"});
    expect((await db.query("select on_hand,reserved from master_supply_products where id=$1",[product])).rows).toEqual(before);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${manager}',false);`);
    expect((await db.query<{rejection_reason:string}>("select rejection_reason from master_supply_requests where id=$1",[id])).rows[0].rejection_reason).toBe("Product is being replaced");
    await db.exec("reset role;");
  });
  it("does not over-reserve when overlapping distributions compete for the same central product",async()=>{
    const id=crypto.randomUUID();
    await mutate(fa,"create_product",{id,sku:id,name:"Concurrent supply",category:"Flower",subcategory:"Hybrid",strainType:"Hybrid",cultivationType:"Indoor",price:20,quantity:3});
    const outcomes=await Promise.allSettled([store,siblingStore].map(storeId=>mutate(fa,"distribute",{id:crypto.randomUUID(),storeId,requestId:null,deliveryMethod:"standard",notes:"",items:[{productId:id,quantity:2}]})));
    expect(outcomes.filter(result=>result.status==="fulfilled")).toHaveLength(1);
    expect(outcomes.filter(result=>result.status==="rejected")).toHaveLength(1);
    expect((await db.query("select on_hand,reserved from master_supply_products where id=$1",[id])).rows[0]).toEqual({on_hand:3,reserved:2});
  });
});
