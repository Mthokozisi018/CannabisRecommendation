import { PGlite } from '../../tmp/pos-local-validation/node_modules/@electric-sql/pglite/dist/index.js';
import { pg_trgm } from '../../tmp/pos-local-validation/node_modules/@electric-sql/pglite/dist/contrib/pg_trgm.js';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite({ extensions: { pg_trgm } });
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create table stores(id uuid primary key, is_active boolean default true, store_access_status text default 'active');
create table staff_profiles(id uuid primary key, auth_user_id uuid, user_id uuid, store_id uuid, role text, account_status text default 'active', is_active boolean default true);
create table products(id uuid primary key, store_id uuid, product_name text, category text, subcategory text, price numeric(12,2), product_status text default 'active', is_visible_on_pos boolean default true, deleted_at timestamptz);
create table inventory_stock(id uuid primary key, product_id uuid, store_id uuid, current_quantity integer, last_updated_by uuid);
create table inventory_movements(id uuid default gen_random_uuid(), store_id uuid, product_id uuid, movement_type text, quantity_changed integer, previous_quantity integer, new_quantity integer, reason text, created_by uuid);
create table audit_logs(id uuid default gen_random_uuid(), user_id uuid, action text, table_name text, record_id uuid, store_id uuid, result text, details jsonb);
create table pos_sales(id uuid primary key default gen_random_uuid(), checkout_id uuid unique, store_id uuid, staff_user_id uuid, subtotal numeric(12,2), total numeric(12,2), created_at timestamptz default now());
create table pos_sale_items(id uuid default gen_random_uuid(), sale_id uuid, product_id uuid, product_name_snapshot text, category_snapshot text, subcategory_snapshot text, unit_price numeric(12,2), quantity integer, line_total numeric(12,2));
create function public.is_store_member(target uuid) returns boolean language sql stable as $$ select target::text = current_setting('test.store',true) $$;
`);
const prior = readFileSync('supabase/migrations/20260830180534_pos_customer_sales_overview.sql','utf8')
 .replace('create extension if not exists pgcrypto;','')
 .replace('revoke all on function public.complete_receptionist_sale_v2(uuid, uuid, jsonb) from public, anon, authenticated, service_role;','');
await db.exec(prior);
await db.exec(`grant usage on schema public to service_role, authenticated; grant all on all tables in schema public to service_role;
insert into stores(id) values ('${uuid(1)}'),('${uuid(2)}');
insert into auth.users values ('${uuid(11)}'),('${uuid(12)}');
insert into staff_profiles(id,auth_user_id,store_id,role) values ('${uuid(21)}','${uuid(11)}','${uuid(1)}','receptionist'),('${uuid(22)}','${uuid(12)}','${uuid(2)}','manager');
insert into products(id,store_id,product_name,price) values ('${uuid(31)}','${uuid(1)}','Synthetic product',750);
insert into inventory_stock(id,product_id,store_id,current_quantity) values ('${uuid(41)}','${uuid(31)}','${uuid(1)}',100);
insert into pos_customers(id,store_id,first_name,surname,full_name,phone_normalized,phone_digits,phone_display) values
('${uuid(51)}','${uuid(1)}','Alice','Local','Alice Local','+27820000001','0820000001','082 000 0001'),
('${uuid(52)}','${uuid(2)}','Alice','Other','Alice Other','+27820000001','0820000001','082 000 0001');
insert into pos_customers(store_id,first_name,surname,full_name,phone_normalized,phone_digits,phone_display)
select '${uuid(1)}', 'Member' || n, 'Surname' || n, 'Member' || n || ' Surname' || n,
 '+2783' || lpad(n::text,7,'0'), '083' || lpad(n::text,7,'0'), '083' || lpad(n::text,7,'0') from generate_series(1,50000) n;
analyze pos_customers;`);
const queries = [
 `select id,first_name,surname,phone_display,phone_normalized from pos_customers where store_id='${uuid(1)}' and deleted_at is null and (first_name ilike '%Member49123%' or surname ilike '%Member49123%' or full_name ilike '%Member49123%') order by updated_at desc limit 8`,
 `select id,first_name,surname,phone_display,phone_normalized from pos_customers where store_id='${uuid(1)}' and deleted_at is null and (first_name ilike '%Surname37541%' or surname ilike '%Surname37541%' or full_name ilike '%Surname37541%') order by updated_at desc limit 8`,
 `select id,first_name,surname,phone_display,phone_normalized from pos_customers where store_id='${uuid(1)}' and deleted_at is null and phone_digits >= '083004912' and phone_digits < '083004913' order by updated_at desc limit 8`
];
async function timings(){ const result=[]; for(const sql of queries){ await db.query(sql); const samples=[]; for(let i=0;i<3;i++){const t=performance.now();await db.query(sql);samples.push(performance.now()-t);}result.push(Math.min(...samples));} return result; }
const before=await timings();
await db.exec(readFileSync('supabase/migrations/20260909122435_pos_payment_and_customer_search.sql','utf8'));
await db.exec('analyze pos_customers');
const after=await timings();
const plans=[];for(const sql of queries) plans.push((await db.query('explain '+sql)).rows);
const cart=JSON.stringify([{productId:uuid(31),quantity:1,unitPrice:750}]);
async function sale(n,method,cash,card,customer=uuid(51),staff=uuid(11)){
 await db.exec('set role service_role');
 try{return await db.query('select * from complete_receptionist_sale_v3($1,$2,$3,$4::jsonb,$5,$6,$7)',[uuid(n),staff,customer,cart,method,cash,card]);}
 finally{await db.exec('reset role');}
}
for(const [n,method,cash,card] of [[101,'cash',750,0],[102,'card',0,750],[103,'split',300,450]]){
 const result=await sale(n,method,cash,card);assert.equal(result.rows[0].already_completed,false);
 const saved=(await db.query('select * from pos_sales where checkout_id=$1',[uuid(n)])).rows[0];
 assert.equal(saved.payment_method,method);assert.equal(Number(saved.cash_amount),cash);assert.equal(Number(saved.card_amount),card);
}
assert.equal((await sale(103,'split',300,450)).rows[0].already_completed,true);
for(const [n,method,cash,card] of [[104,'split',300,449],[105,'split',-1,751],[106,'split',751,0],[107,'split',300.001,449.999],[108,'cash',0,750],[103,'card',0,750]]) await assert.rejects(()=>sale(n,method,cash,card));
await assert.rejects(()=>sale(109,'cash',750,0,uuid(52)));
await db.exec(`update staff_profiles set account_status='deactivated' where auth_user_id='${uuid(11)}'`);
await assert.rejects(()=>sale(110,'cash',750,0));
await db.exec(`update staff_profiles set account_status='active' where auth_user_id='${uuid(11)}'`);
assert.equal((await db.query('select current_quantity from inventory_stock')).rows[0].current_quantity,97);
for(const table of ['pos_sales','pos_sale_items','inventory_movements','audit_logs']) assert.equal(Number((await db.query(`select count(*) as n from ${table}`)).rows[0].n),3);
assert.equal((await db.query('select details from audit_logs limit 1')).rows[0].details.paymentMethod,'cash');
await db.exec(`set role authenticated; set test.store='${uuid(1)}'`);
const scoped=await db.query("select id from pos_customers where first_name='Alice'");assert.deepEqual(scoped.rows,[{id:uuid(51)}]);
await assert.rejects(()=>db.query('select * from complete_receptionist_sale_v3($1,$2,$3,$4::jsonb,$5,$6,$7)',[uuid(111),uuid(11),uuid(51),cart,'cash',750,0]));
await db.exec('reset role');
const report={database:'isolated PGlite PostgreSQL; synthetic fixture schema and actual v2/v3 functions',customers:50002,beforeMs:before,afterMs:after,speedup:before.map((v,i)=>v/after[i]),plans,checks:'cash/card/split saved; invalid allocations roll back; retry idempotency; payment mismatch rejected; cross-store customer and deactivated staff rejected; stock 100 -> 97; exactly 3 sales/items/movements/audits; authenticated customer RLS isolation; RPC grants'};
writeFileSync('tmp/pos-local-validation/database-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await db.close();
