import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite({ extensions: { pg_trgm } });
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create table stores(id uuid primary key, is_active boolean default true, store_access_status text default 'active');
create table staff_profiles(id uuid primary key, auth_user_id uuid, user_id uuid, store_id uuid, role text, account_status text default 'active', is_active boolean default true);
create table products(id uuid primary key, store_id uuid, product_name text, category text, subcategory text, strain_type text, cultivation_type text, image_url text, price numeric(12,2), product_status text default 'active', is_visible_on_pos boolean default true, deleted_at timestamptz);
create table inventory_stock(id uuid primary key, product_id uuid, store_id uuid, current_quantity integer, last_updated_by uuid);
create table inventory_movements(id uuid default gen_random_uuid(), store_id uuid, product_id uuid, movement_type text, quantity_changed integer, previous_quantity integer, new_quantity integer, reason text, created_by uuid);
create table audit_logs(id uuid default gen_random_uuid(), user_id uuid, action text, table_name text, record_id uuid, store_id uuid, result text, details jsonb);
create table pos_sales(id uuid primary key default gen_random_uuid(), checkout_id uuid unique, store_id uuid, staff_user_id uuid, subtotal numeric(12,2), total numeric(12,2), status text default 'completed', created_at timestamptz default now());
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
('${uuid(52)}','${uuid(2)}','Alice','Other','Alice Other','+27820000001','0820000001','082 000 0001');`);

await db.exec(readFileSync('supabase/migrations/20260909122435_pos_payment_and_customer_search.sql','utf8'));
await db.exec(readFileSync('supabase/migrations/20261016095315_pos_sale_confirmation.sql','utf8'));
await db.exec('grant all on pos_sales to service_role');
const cart=JSON.stringify([{productId:uuid(31),quantity:1,unitPrice:750}]);
async function sale(n,method,cash,card){
 await db.exec('set role service_role');
 try{return (await db.query('select * from complete_receptionist_sale_v3($1,$2,$3,$4::jsonb,$5,$6,$7)',[uuid(n),uuid(11),uuid(51),cart,method,cash,card])).rows[0];}
 finally{await db.exec('reset role');}
}
await db.exec(`update products set strain_type='Hybrid',cultivation_type='Indoor',image_url='/test-product.png'`);
const ids=[];
for(const [n,method,cash,card] of [[101,'cash',750,0],[102,'card',0,750],[103,'split',300,450]]){
 const result=await sale(n,method,cash,card);ids.push(result.sale_id);assert.equal(result.already_completed,false);
 assert.equal((await sale(n,method,cash,card)).already_completed,true);
}
for(const args of [[104,'split',300,449],[105,'cash',0,750],[106,'split',-1,751]])await assert.rejects(()=>sale(...args));
async function amend(id,request,version,kind,payment,actor=uuid(11),reason='Customer requested correction',returned=true){
 await db.exec('set role service_role');
 try{await db.query('select amend_pos_transaction($1,$2,$3,$4,$5,$6,$7::jsonb,$8)',[id,actor,uuid(request),version,kind,reason,JSON.stringify(payment),returned]);}
 finally{await db.exec('reset role');}
}
const cash={method:'cash',cashAmount:750,cardAmount:0},card={method:'card',cashAmount:0,cardAmount:750},split={method:'split',cashAmount:300,cardAmount:450};
await assert.rejects(()=>amend(ids[0],201,0,'payment_correction',card,uuid(12))); // other store
await assert.rejects(()=>amend(ids[0],201,0,'payment_correction',{...split,cardAmount:449}));
await assert.rejects(()=>amend(ids[0],201,0,'payment_correction',card,uuid(11),' '));
await amend(ids[0],201,0,'payment_correction',card);
await amend(ids[0],201,0,'payment_correction',card); // retry does not duplicate
await assert.rejects(()=>amend(ids[0],201,0,'payment_correction',split)); // key reused
await assert.rejects(()=>amend(ids[0],202,0,'payment_correction',split)); // stale version
await amend(ids[0],202,1,'payment_correction',split);
await assert.rejects(()=>amend(ids[0],203,2,'refund',split,uuid(11),'Returned product',false));
await amend(ids[0],203,2,'refund',split,uuid(11),'Returned product');
await amend(ids[0],203,2,'refund',split,uuid(11),'Returned product');
await assert.rejects(()=>amend(ids[0],204,3,'refund',split));
await assert.rejects(()=>amend(ids[0],205,3,'payment_correction',cash));
await db.exec(`update pos_sales set payment_provider='external' where id='${ids[1]}'`);
await assert.rejects(()=>amend(ids[1],206,0,'refund',card));
await assert.rejects(()=>amend(ids[1],207,0,'payment_correction',cash));
await db.exec(`update staff_profiles set account_status='deactivated' where auth_user_id='${uuid(11)}'`);
await assert.rejects(()=>amend(ids[2],208,0,'refund',split));
await db.exec(`update staff_profiles set account_status='active' where auth_user_id='${uuid(11)}'`);
await amend(ids[2],208,0,'refund',split);
assert.equal((await db.query('select current_quantity from inventory_stock')).rows[0].current_quantity,97);
assert.equal(Number((await db.query('select count(*) n from pos_sale_events')).rows[0].n),4);
assert.equal(Number((await db.query('select sum(total-refunded_amount) net from pos_sales')).rows[0].net),750);
await db.exec(`alter table pos_sales enable row level security; create policy sales_read on pos_sales for select to authenticated using (is_store_member(store_id)); grant select on pos_sales,pos_sale_items to authenticated; alter table pos_sale_items enable row level security; create policy items_read on pos_sale_items for select to authenticated using (exists(select 1 from pos_sales where id=sale_id)); set role authenticated; set test.store='${uuid(1)}'`);
let receipt=(await db.query('select get_pos_receipt($1,$2) receipt',[ids[0],uuid(1)])).rows[0].receipt;
assert.equal(receipt.refund_status,'refunded');assert.equal(receipt.customer.full_name,'Alice Local');assert.equal(receipt.items.length,1);assert.equal(receipt.items[0].strain_snapshot,'Hybrid');assert.equal(receipt.items[0].cultivation_snapshot,'Indoor');assert.equal(receipt.items[0].image_snapshot,'/test-product.png');assert.equal(receipt.events.length,3);assert.equal(receipt.events[0].before_payment.method,'cash');assert.equal(Number(receipt.refunded_amount),750);
assert.equal((await db.query("select jsonb_array_length(search_pos_transactions($1,'Alice',null,0)) n",[uuid(1)])).rows[0].n,3);
assert.equal((await db.query("select jsonb_array_length(search_pos_transactions($1,'0820000001',null,0)) n",[uuid(1)])).rows[0].n,3);
await assert.rejects(()=>db.query("update pos_sale_events set reason='hidden'"));
await assert.rejects(()=>db.query('delete from pos_sale_events'));
await assert.rejects(()=>db.query("select amend_pos_transaction($1,$2,$3,0,'refund','fake refund',$4::jsonb,true)",[ids[1],uuid(11),uuid(301),JSON.stringify(card)]));
assert.equal((await db.query("select jsonb_array_length(search_pos_transactions($1,'',date '2000-01-01',0)) n",[uuid(1)])).rows[0].n,0);
await db.exec(`set test.store='${uuid(2)}'`);
assert.equal((await db.query('select get_pos_receipt($1,$2) receipt',[ids[0],uuid(1)])).rows[0].receipt,null);
assert.equal((await db.query('select count(*) n from pos_sale_events')).rows[0].n,0);
assert.equal((await db.query("select jsonb_array_length(search_pos_transactions($1,'',null,0)) n",[uuid(1)])).rows[0].n,0);
await db.exec('reset role');if (!process.env.POS_CONFIRMATION_BROWSER) await db.close();
console.log('PASS: cash/card/split atomic checkout, invalid payment rollback, idempotency, corrections and original audit, stale requests, cross-store denial, provider block, external refund confirmation, duplicate refund prevention, net revenue, no restocking, read RLS and write grants.');

export { db, uuid, sale };
