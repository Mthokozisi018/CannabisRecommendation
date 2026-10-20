import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, writeFileSync } from "node:fs";
let db: PGlite;
const admin = "10000000-0000-4000-8000-000000000001",
  fa = "10000000-0000-4000-8000-000000000002",
  other = "10000000-0000-4000-8000-000000000003";
const franchiseA = "20000000-0000-4000-8000-000000000001",
  franchiseB = "20000000-0000-4000-8000-000000000002";
const storeA = "30000000-0000-4000-8000-000000000001",
  storeB = "30000000-0000-4000-8000-000000000002",
  independent = "30000000-0000-4000-8000-000000000003";
const call = (actor: string, action: string, data: Record<string, unknown>) =>
  db.query<{ id: string }>("select public.franchise_mutation($1,$2,$3) as id", [
    actor,
    action,
    JSON.stringify(action === "create_store" ? { idempotencyKey: crypto.randomUUID(), ...data } : data),
  ]);
async function identity(id: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`,
  );
}
describe("Independent FA audit; disposable selected-migration fixture", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb);
      create table public.stores(id uuid primary key default gen_random_uuid(),name text,slug text,created_at timestamptz default now(),updated_at timestamptz default now(),
        is_active boolean default true,store_access_status text default 'active',address text,store_address text,physical_store_address text,store_phone_number text,store_contact_email text,
        city text,province text,postal_code text,opening_hours jsonb,store_information_confirmed_at timestamptz,store_information_confirmed_by uuid,store_image_bucket text,store_image_path text,store_image_url text);
      create table public.staff_profiles(id uuid primary key default gen_random_uuid(),auth_user_id uuid unique references auth.users,user_id uuid,email text,full_name text,first_name text,surname text,mobile_number text,phone_number text,
        role text constraint staff_profiles_role_check check(role in ('admin','manager','receptionist')),store_id uuid references stores,created_by uuid,account_status text default 'active',is_active boolean default true,
        account_setup_complete boolean default false,profile_setup_complete boolean default false,store_setup_complete boolean default false,temporary_password_active boolean default true,
        password_changed_at timestamptz,terms_accepted boolean,terms_accepted_at timestamptz,privacy_policy_accepted_at timestamptz,terms_version text,privacy_policy_version text,onboarding_completed_at timestamptz,onboarding_complete_seen_at timestamptz);
      create table public.audit_logs(id uuid primary key default gen_random_uuid(),user_id uuid,action text,table_name text,record_id uuid,store_id uuid references stores,result text,details jsonb,created_at timestamptz default now());
      create table public.store_memberships(user_id uuid,store_id uuid);
      create table public.pos_sales(id uuid primary key default gen_random_uuid(),store_id uuid references stores,status text,created_at timestamptz default now());
      create table public.pos_sale_items(id uuid primary key default gen_random_uuid(),sale_id uuid references pos_sales);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text);
      create function public.is_greenchoice_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from staff_profiles where auth_user_id=auth.uid() and role='admin')$$;
      grant usage on schema auth,public,storage to authenticated,service_role;
      grant all on all tables in schema public to service_role;
      grant select on all tables in schema public to authenticated;
      alter table stores enable row level security; alter table staff_profiles enable row level security;
      alter table audit_logs enable row level security; alter table pos_sales enable row level security; alter table pos_sale_items enable row level security;
      alter table storage.objects enable row level security;
      create policy existing_public_stores on stores for select to authenticated using(true);
      create policy self_profile on staff_profiles for select to authenticated using(auth_user_id=auth.uid());
    `);
    for (const table of [
      "products",
      "inventory_stock",
      "pos_customers",
      "store_media",
    ]) {
      await db.exec(
        `create table public.${table}(id uuid primary key default gen_random_uuid(),store_id uuid references stores); alter table public.${table} enable row level security; grant select on public.${table} to authenticated; grant all on public.${table} to service_role;`,
      );
    }
    await db.exec(
      readFileSync(
        "supabase/migrations/20261010085411_franchise_administration.sql",
        "utf8",
      ),
    );
    await db.exec(
      "alter table pos_sales add column total numeric; alter table pos_customers add column deleted_at timestamptz;",
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20261013060837_franchise_dashboard_aggregates.sql",
        "utf8",
      ),
    );
    await db.exec(`alter table staff_profiles add column physical_address text, add column city text, add column province text, add column postal_code text, add column temporary_password_fingerprint text;
      alter table auth.users add column email_confirmed_at timestamptz default now(), add column deleted_at timestamptz, add column banned_until timestamptz;`);
    await db.exec(readFileSync("supabase/migrations/20261015083038_franchise_staff_self_onboarding.sql", "utf8"));
    await db.exec("alter table pos_sales add column refunded_amount numeric default 0; alter table pos_sale_items add column quantity numeric, add column line_total numeric, add column product_name_snapshot text, add column category_snapshot text;");
    await db.exec(readFileSync("supabase/migrations/20261016174201_franchise_admin_remediation.sql", "utf8"));
    const receptionistSql=readFileSync("supabase/migrations/20260804140000_direct_receptionist_accounts.sql", "utf8");
    const receptionistStart=receptionistSql.indexOf("create or replace function public.complete_manager_created_receptionist_setup(");
    const receptionistEnd=receptionistSql.indexOf("to authenticated;",receptionistStart)+"to authenticated;".length;
    await db.exec(receptionistSql.slice(receptionistStart,receptionistEnd));
    await db.exec(`
      insert into auth.users(id,email) values('${admin}','admin@example.invalid'),('${fa}','fa@example.invalid'),('${other}','other@example.invalid');
      insert into franchises(id,name,contact_email,phone,address) values('${franchiseA}','Franchise A','a@example.invalid','0821234567','Address A'),('${franchiseB}','Franchise B','b@example.invalid','0821234567','Address B');
      insert into staff_profiles(auth_user_id,role,franchise_id,account_status,is_active,account_setup_complete,temporary_password_active,password_changed_at,terms_accepted_at,privacy_policy_accepted_at)
      values('${admin}','admin',null,'active',true,true,false,now(),now(),now()),('${fa}','franchise_admin','${franchiseA}','active',true,true,false,now(),now(),now()),('${other}','franchise_admin','${franchiseB}','active',true,true,false,now(),now(),now());
      insert into stores(id,name,franchise_id) values('${storeA}','A','${franchiseA}'),('${storeB}','B','${franchiseB}'),('${independent}','Independent',null);
      insert into pos_sales(store_id,status) values('${storeA}','completed'),('${storeB}','completed');
      insert into pos_sale_items(sale_id) select id from pos_sales;
      insert into products(store_id) values('${storeA}'),('${storeB}');
    `);
  }, 30000);
  afterAll(async () => {
    await db?.close();
  });

  it("AUD-DB-01: reverse franchise isolation covers every FA read table", async()=>{
    await db.exec(`reset role; insert into inventory_stock(store_id) values('${storeA}'),('${storeB}'); insert into pos_customers(store_id) values('${storeA}'),('${storeB}'); insert into store_media(store_id) values('${storeA}'),('${storeB}'); insert into audit_logs(store_id) values('${storeA}'),('${storeB}');`);
    for(const actor of [fa,other]){
      await identity(actor);
      const own=actor===fa?storeA:storeB;
      for(const table of ['stores','products','inventory_stock','pos_customers','store_media','audit_logs','pos_sales']){
        const column=table==='stores'?'id':'store_id';
        const rows=(await db.query<Record<string,string>>(`select ${column} from ${table}`)).rows;
        expect(rows.length,table).toBeGreaterThan(0);expect(rows.every(r=>r[column]===own),table).toBe(true);
      }
    }
  });
  it("AUD-DB-02: missing identity cannot invoke report or service mutation",async()=>{
    await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role authenticated");
    expect((await db.query('select * from franchises')).rows).toEqual([]);
    await expect(db.query("select franchise_dashboard_totals($1,now()-interval '1 day',now())",[franchiseA])).rejects.toThrow('Franchise access denied');
    await expect(call(fa,'create_store',{})).rejects.toThrow('permission denied');
  });
  it.each(['manager','receptionist','customer'])("AUD-DB-03: %s cannot invoke FA reporting or mutations",async(role)=>{
    const user='10000000-0000-4000-8000-000000000088';
    await db.exec('reset role;begin');
    try{
      await db.query('insert into auth.users(id,email) values($1,$2)',[user,role+'@example.invalid']);
      if(role!=='customer') await db.query('insert into staff_profiles(auth_user_id,role,store_id) values($1,$2,$3)',[user,role,storeA]);
      await identity(user);
      await db.exec('savepoint denied');
      await expect(db.query("select franchise_dashboard_totals($1,now()-interval '1 day',now())",[franchiseA])).rejects.toThrow('Franchise access denied');
      await db.exec('rollback to savepoint denied');
      await expect(call(fa,'update_store',{storeId:storeA})).rejects.toThrow('permission denied');
    }finally{await db.exec('rollback;reset role')}
  });
  it("AUD-DB-04: audit failure rolls back store insertion",async()=>{
    await db.exec(`reset role;create function public.audit_force_failure() returns trigger language plpgsql as $$begin raise exception 'synthetic audit unavailable';end$$;create trigger force_audit_failure before insert on audit_logs for each row execute function audit_force_failure();set role service_role`);
    try{
      await expect(call(fa,'create_store',{name:'Rollback fixture',slug:'rollback-fixture'})).rejects.toThrow('synthetic audit unavailable');
      expect((await db.query("select id from stores where slug='rollback-fixture'")).rows).toEqual([]);
    }finally{await db.exec('reset role;drop trigger force_audit_failure on audit_logs;drop function audit_force_failure()')}
  });
  it("AUD-DB-05: FA net revenue reconciles with refunded completed sales",async()=>{
    await db.exec(`reset role;insert into pos_sales(store_id,status,total,refunded_amount,created_at) values('${storeA}','completed',125,125,'2026-10-15T10:00:00Z');`);
    await identity(fa);
    const rows=await db.query<{totals:{daily:{revenue:number}[]}}>("select franchise_dashboard_totals($1,'2026-10-14T22:00:00Z','2026-10-15T22:00:00Z') totals",[franchiseA]);
    const net=Number((await db.query<{net:string}>("select sum(total-refunded_amount) net from pos_sales where created_at>='2026-10-14T22:00:00Z' and created_at<'2026-10-15T22:00:00Z'")).rows[0].net);
    expect(net).toBe(0);expect(Number(rows.rows[0].totals.daily[0].revenue)).toBe(net);
  });
  it("AUD-DB-06: duplicate store retries should resolve to one store",async()=>{
    await db.exec('reset role;set role service_role');
    const data={idempotencyKey:crypto.randomUUID(),name:'Retry fixture',address:'123 Test Road',phone:'0821234567',email:'test@example.invalid',city:'Test City',province:'Gauteng',postalCode:'2000'};
    await call(fa,'create_store',{...data,slug:'retry-fixture-aaaa'});
    await call(fa,'create_store',{...data,slug:'retry-fixture-bbbb'});
    expect((await db.query("select id from stores where name='Retry fixture'")).rows).toHaveLength(1);
  });
  it("AUD-DB-07: measured 10000-sale aggregation stays scoped and reconciles",async()=>{
    await db.exec(`reset role;insert into pos_sales(store_id,status,total,created_at) select '${storeA}','completed',0.1,'2025-01-01T12:00:00Z'::timestamptz+(n%365)*interval '1 day' from generate_series(1,10000)n;analyze pos_sales;`);
    await identity(fa);
    const samples=[];
    for(let i=0;i<5;i++){
      const start=performance.now();const r=await db.query<{totals:{daily:{revenue:number,transactions:number}[]}}>("select franchise_dashboard_totals($1,'2025-01-01T00:00:00+02:00','2026-01-01T00:00:00+02:00',null,false) totals",[franchiseA]);samples.push(performance.now()-start);
      expect(r.rows[0].totals.daily.reduce((n,r)=>n+Math.round(Number(r.revenue)*100),0)).toBe(100000);
      expect(r.rows[0].totals.daily.reduce((n,r)=>n+Number(r.transactions),0)).toBe(10000);
    }
    writeFileSync('../docs/fa-remediation-evidence/pglite-performance.json',JSON.stringify({rows:10000,samplesMs:samples,rssBytes:process.memoryUsage().rss,scope:'PGlite WASM single-store, selected migrations; not hosted PostgreSQL'},null,2));
  });
  it("replays one store result without duplicate audit/resources and rejects a changed payload",async()=>{
    await db.exec('reset role;set role service_role');
    const data={idempotencyKey:crypto.randomUUID(),name:'Idempotent store',slug:'idempotent-a'};
    const results=await Promise.all(Array.from({length:6},(_,i)=>call(fa,'create_store',{...data,slug:'idempotent-'+i})));
    expect(new Set(results.map(r=>r.rows[0].id)).size).toBe(1);
    const id=results[0].rows[0].id;
    expect((await db.query('select id from audit_logs where record_id=$1',[id])).rows).toHaveLength(1);
    await expect(call(fa,'create_store',{...data,name:'Different details'})).rejects.toThrow('request key was already used');
    const different=await call(fa,'create_store',{...data,idempotencyKey:crypto.randomUUID(),name:'Second legitimate store',slug:'second-legitimate'});
    expect(different.rows[0].id).not.toBe(id);
    await db.exec(`reset role; update staff_profiles set account_status='restricted' where auth_user_id='${fa}';set role service_role`);
    await expect(call(fa,'create_store',data)).rejects.toThrow('Access denied');
    await db.exec(`reset role;update staff_profiles set account_status='active' where auth_user_id='${fa}'`);
  });
  it("requires a request key and prevents browser access to the ledger or unkeyed function",async()=>{
    await db.exec('reset role;set role service_role');
    await expect(db.query("select franchise_mutation($1,'create_store',$2)",[fa,JSON.stringify({name:'No key'})])).rejects.toThrow('request key is required');
    await expect(db.query("select private.franchise_mutation_unkeyed($1,'create_store','{}')",[fa])).rejects.toThrow('permission denied');
    await identity(fa);await expect(db.query('select * from private.franchise_store_requests')).rejects.toThrow('permission denied');
  });
  it("allocates net cents exactly across products/categories, preserves units and excludes cancelled/foreign sales",async()=>{
    await db.exec(`reset role; insert into pos_sales(id,store_id,status,total,refunded_amount,created_at) values
      ('40000000-0000-4000-8000-000000000001','${storeA}','completed',10.00,0.02,'2023-12-31T22:00:00Z'),
      ('40000000-0000-4000-8000-000000000002','${storeA}','completed',125,125,'2023-12-31T21:59:59Z'),
      ('40000000-0000-4000-8000-000000000003','${storeA}','cancelled',900,0,'2023-12-31T22:00:00Z'),
      ('40000000-0000-4000-8000-000000000004','${storeB}','completed',99999,0,'2023-12-31T22:00:00Z');
      insert into pos_sale_items(sale_id,quantity,line_total,product_name_snapshot,category_snapshot)
      select '40000000-0000-4000-8000-000000000001',1,4,'Product '||n,case when n=1 then 'Flower' else 'Other' end from generate_series(1,3)n;
      insert into pos_sale_items(sale_id,quantity,line_total,product_name_snapshot,category_snapshot) values('40000000-0000-4000-8000-000000000002',2,125,'Refunded','Flower');`);
    await identity(fa);
    const totals=(await db.query<{totals:{daily:{revenue:number,transactions:number}[]}}>("select franchise_dashboard_totals_v2($1,'2023-12-30T22:00:00Z','2024-01-01T22:00:00Z') totals",[franchiseA])).rows[0].totals;
    expect(totals.daily).toMatchObject([{day:'2023-12-31',revenue:0,transactions:1},{day:'2024-01-01',revenue:9.98,transactions:1}]);
    const detail=(await db.query<{totals:{categories:{value:number}[],products:{revenue:number,quantity:number}[]}}>("select franchise_store_item_totals($1,'2023-12-30T22:00:00Z','2024-01-01T22:00:00Z') totals",[storeA])).rows[0].totals;
    expect(detail.categories.reduce((n,r)=>n+Math.round(r.value*100),0)).toBe(998);
    expect(detail.products.reduce((n,r)=>n+Math.round(r.revenue*100),0)).toBe(998);
    expect(detail.products.reduce((n,r)=>n+Number(r.quantity),0)).toBe(5);
    await expect(db.query("select franchise_store_item_totals($1,'2024-01-01','2024-01-02')",[storeB])).rejects.toThrow('Store access denied');
  });

});
