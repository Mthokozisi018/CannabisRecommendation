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
      create table public.franchises(id uuid primary key);
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
      insert into franchises values('${franchise}'),('${otherFranchise}');
      insert into stores(id,franchise_id,name) values('${store}','${franchise}','A'),('${otherStore}','${otherFranchise}','B'),('${independentStore}',null,'Independent'),('${siblingStore}','${franchise}','Sibling');
      insert into staff_profiles values('${fa}','franchise_admin',null,'${franchise}',true,'active',true),('${manager}','manager','${store}',null,true,'active',true),('${otherFa}','franchise_admin',null,'${otherFranchise}',true,'active',true),('${otherManager}','manager','${otherStore}',null,true,'active',true),('${independentManager}','manager','${independentStore}',null,true,'active',true),('${siblingManager}','manager','${siblingStore}',null,true,'active',true);
      insert into categories values('70000000-0000-4000-8000-000000000001','Flower',true),('70000000-0000-4000-8000-000000000002','Pre-Rolls',true),('70000000-0000-4000-8000-000000000003','Vape Cartridges',true);
    `);
    await db.exec(readFileSync("supabase/migrations/20261019132156_master_supply.sql","utf8"));
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
    expect((await db.query("select id from master_supply_products")).rows).toHaveLength(1);
    expect((await db.query("select id from master_supply_requests")).rows).toHaveLength(1);
    await db.exec("reset role;");
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${otherManager}',false);`);
    expect((await db.query("select id from master_supply_products")).rows).toHaveLength(0);
    expect((await db.query("select id from master_supply_distributions")).rows).toHaveLength(0);
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${independentManager}',false);`);
    expect((await db.query("select id from master_supply_products")).rows).toHaveLength(0);
    await db.exec("reset role; set role anon;");
    await expect(db.query("select public.master_supply_mutation($1,'request','{}'::jsonb)",[manager])).rejects.toThrow();
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${siblingManager}',false);`);
    expect((await db.query("select id from master_supply_products")).rows).toHaveLength(1);
    expect((await db.query("select id from master_supply_requests")).rows).toHaveLength(0);
    expect((await db.query("select id from master_supply_distributions")).rows).toHaveLength(0);
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
});
