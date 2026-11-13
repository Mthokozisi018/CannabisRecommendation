import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

const storeA = "10000000-0000-4000-8000-000000000001";
const storeB = "10000000-0000-4000-8000-000000000002";
const supplierA = "20000000-0000-4000-8000-000000000001";
const supplierB = "20000000-0000-4000-8000-000000000002";
const productOne = "30000000-0000-4000-8000-000000000001";
const productTwo = "30000000-0000-4000-8000-000000000002";
const productOtherStore = "30000000-0000-4000-8000-000000000003";
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select '40000000-0000-4000-8000-000000000001'::uuid$$;
    create function public.current_staff_store_id() returns uuid language sql stable as $$select current_setting('test.store_id')::uuid$$;
    create function public.is_greenchoice_manager() returns boolean language sql stable as $$select true$$;
    create table public.products(id uuid primary key,store_id uuid not null,product_name text,category text,subcategory text,cultivation_type text,deleted_at timestamptz);
    create table public.suppliers(id uuid primary key,store_id uuid not null,status text not null);
    create table public.inventory_stock(id uuid primary key default gen_random_uuid(),product_id uuid unique,store_id uuid,current_quantity numeric not null,last_updated_by uuid);
    create table public.inventory_movements(id uuid primary key default gen_random_uuid(),store_id uuid,product_id uuid,movement_type text,quantity_changed numeric,previous_quantity numeric,new_quantity numeric,reason text,created_by uuid);
    create table public.supply_deliveries(id uuid primary key,store_id uuid,supplier_id uuid,reference text,recorded_by uuid,total_cost numeric);
    create table public.supply_delivery_items(id uuid primary key default gen_random_uuid(),delivery_id uuid,store_id uuid,product_id uuid,inventory_movement_id uuid,product_name_snapshot text,category_snapshot text,subcategory_snapshot text,cultivation_type_snapshot text,quantity numeric,unit text,unit_cost numeric,line_total numeric);
    create table public.audit_logs(id uuid primary key default gen_random_uuid(),user_id uuid,action text,table_name text,record_id uuid,store_id uuid,result text,details jsonb);
  `);
  await db.exec(readFileSync("supabase/migrations/20261113072051_reuse_store_suppliers_for_stock_receipts.sql", "utf8"));
  await db.query("insert into products(id,store_id,product_name,category,subcategory) values ($1,$2,'Lighter','Accessories','Lighters'),($3,$2,'Rolling Papers','Accessories','Rolling Papers'),($4,$5,'Other store product','Accessories','Lighters')", [productOne, storeA, productTwo, productOtherStore, storeB]);
  await db.query("insert into suppliers(id,store_id,status) values ($1,$2,'active'),($3,$4,'active')", [supplierA, storeA, supplierB, storeB]);
  await db.query("insert into inventory_stock(product_id,store_id,current_quantity) values ($1,$2,0),($3,$2,0),($4,$5,0)", [productOne, storeA, productTwo, productOtherStore, storeB]);
  await db.query("select set_config('test.store_id',$1,false)", [storeA]);
}, 30000);

afterAll(async () => { await db?.close(); });

it("reuses one store supplier for different products and keeps delivery history", async () => {
  const first = await db.query<{new_quantity:number}>("select new_quantity from public.receive_inventory_stock_atomic($1,$2,2,10,'test')", [productOne, supplierA]);
  const second = await db.query<{new_quantity:number}>("select new_quantity from public.receive_inventory_stock_atomic($1,$2,3,5,'test')", [productTwo, supplierA]);
  expect(first.rows[0].new_quantity).toBe(2);
  expect(second.rows[0].new_quantity).toBe(3);
  const history = await db.query<{deliveries:number;items:number;movements:number;audits:number}>("select (select count(*) from supply_deliveries)::int deliveries,(select count(*) from supply_delivery_items)::int items,(select count(*) from inventory_movements)::int movements,(select count(*) from audit_logs)::int audits");
  expect(history.rows[0]).toEqual({ deliveries: 2, items: 2, movements: 2, audits: 2 });
});

it("rejects another store's supplier and product without changing stock", async () => {
  await expect(db.query("select * from public.receive_inventory_stock_atomic($1,$2,1,10,'test')", [productOne, supplierB])).rejects.toThrow("supplier_not_authorized_for_store");
  await expect(db.query("select * from public.receive_inventory_stock_atomic($1,$2,1,10,'test')", [productOtherStore, supplierA])).rejects.toThrow("product_unavailable");
  const stock = await db.query<{current_quantity:number}>("select current_quantity from inventory_stock where product_id=$1", [productOne]);
  expect(Number(stock.rows[0].current_quantity)).toBe(2);
});

it("rejects zero quantity and inactive suppliers", async () => {
  await expect(db.query("select * from public.receive_inventory_stock_atomic($1,$2,0,10,'test')", [productOne, supplierA])).rejects.toThrow("invalid_supply_intake");
  await db.query("update suppliers set status='inactive' where id=$1", [supplierA]);
  await expect(db.query("select * from public.receive_inventory_stock_atomic($1,$2,1,10,'test')", [productOne, supplierA])).rejects.toThrow("supplier_not_authorized_for_store");
});
