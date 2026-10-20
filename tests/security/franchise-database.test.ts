import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
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
describe("Franchise migration, authorization and store capacity", () => {
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
    await db.exec(readFileSync("supabase/migrations/20261020090458_speed_up_franchise_sales_totals.sql", "utf8"));
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
  it("limits reads to the authenticated franchise even with broad pre-existing store policies", async () => {
    await identity(fa);
    expect(
      (await db.query<{ id: string }>("select id from stores")).rows,
    ).toEqual([{ id: storeA }]);
    expect((await db.query("select * from pos_sales")).rows).toHaveLength(1);
    expect((await db.query("select * from pos_sale_items")).rows).toHaveLength(
      1,
    );
    expect((await db.query("select * from products")).rows).toHaveLength(1);
    expect(
      (await db.query<{ id: string }>("select id from franchises")).rows,
    ).toEqual([{ id: franchiseA }]);
  });
  it("keeps manager login history store-specific under the existing audit RLS", async () => {
    const sibling = "30000000-0000-4000-8000-000000000099";
    await db.exec("begin; reset role");
    try {
      await db.exec(`insert into stores(id,name,franchise_id) values('${sibling}','Sibling','${franchiseA}');
        insert into audit_logs(store_id,user_id,action,result,details,created_at) values
        ('${storeA}','${fa}','login_success','success','{"role":"manager"}','2026-10-14T22:00:00Z'),
        ('${storeA}','${fa}','login_success','success','{"role":"manager"}','2026-10-14T21:59:59Z'),
        ('${storeA}','${fa}','login_success','success','{"role":"receptionist"}','2026-10-15T08:00:00Z'),
        ('${sibling}','${fa}','login_success','success','{"role":"manager"}','2026-10-15T08:00:00Z'),
        ('${storeB}','${other}','login_success','success','{"role":"manager"}','2026-10-15T08:00:00Z');`);
      await identity(fa);
      const sql = "select store_id,created_at from audit_logs where store_id=$1 and action='login_success' and details->>'role'='manager' and created_at >= '2026-10-15T00:00:00+02:00' and created_at < '2026-10-16T00:00:00+02:00' order by created_at desc,id desc limit 26 offset 0";
      expect((await db.query<{store_id:string}>(sql, [storeA])).rows).toMatchObject([{store_id:storeA}]);
      expect((await db.query(sql, [storeB])).rows).toEqual([]);
      await identity(other);
      expect((await db.query(sql, [storeA])).rows).toEqual([]);
    } finally { await db.exec("rollback"); }
  });
  it("blocks database reads until setup and password replacement are complete", async () => {
    await db.exec(
      `reset role; update staff_profiles set temporary_password_active=true where auth_user_id='${fa}'`,
    );
    await identity(fa);
    expect((await db.query("select * from stores")).rows).toHaveLength(0);
    await expect(
      db.query(
        "select franchise_dashboard_totals($1,now()-interval '1 day',now())",
        [franchiseA],
      ),
    ).rejects.toThrow("Franchise access denied");
    expect((await db.query("select * from pos_sales")).rows).toHaveLength(0);
    await db.exec(
      `reset role; update staff_profiles set temporary_password_active=false where auth_user_id='${fa}'`,
    );
  });
  it("blocks browser mutation, privilege escalation and setup RPC bypass", async () => {
    await identity(fa);
    await expect(call(fa, "complete_setup", {})).rejects.toThrow(
      "permission denied",
    );
    await expect(
      db.exec(
        `update staff_profiles set role='admin' where auth_user_id='${fa}'`,
      ),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role;set role service_role");
    await expect(call(fa, "create_franchise", {})).rejects.toThrow(
      "Administrator access required",
    );
    await expect(call(fa, "update_store", { storeId: storeB })).rejects.toThrow(
      "Store access denied",
    );
  });
  it("derives new store franchise on the server and audits the operation atomically", async () => {
    await db.exec("reset role;set role service_role");
    const result = await call(fa, "create_store", {
      name: "New Store",
      slug: "new-store",
      franchiseId: franchiseB,
      address: "Test address",
      phone: "0821234567",
      email: "store@example.invalid",
      city: "Test City",
      province: "Gauteng",
      postalCode: "2000",
    });
    expect(
      (
        await db.query<{ franchise_id: string }>(
          "select franchise_id from stores where id=$1",
          [result.rows[0].id],
        )
      ).rows[0].franchise_id,
    ).toBe(franchiseA);
    expect(
      (
        await db.query("select * from audit_logs where record_id=$1", [
          result.rows[0].id,
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it("enforces three assigned managers and five occupied receptionist slots for all writers", async () => {
    await db.exec("reset role");
    for (const role of ["manager", "receptionist"]) {
      const limit = role === "manager" ? 3 : 5;
      for (let i = 0; i < limit; i++)
        await db.query(
          "insert into staff_profiles(role,store_id,account_status,is_active) values($1,$2,'active',true)",
          [role, independent],
        );
      await expect(
        db.query(
          "insert into staff_profiles(role,store_id,account_status) values($1,$2,'active')",
          [role, independent],
        ),
      ).rejects.toThrow("limit reached");
    }
    const receptionist = await db.query<{ id: string }>(
      "insert into staff_profiles(role,store_id,account_status) values('receptionist',$1,'deactivated') returning id",
      [independent],
    );
    await expect(
      db.query(
        "update staff_profiles set account_status='active' where id=$1",
        [receptionist.rows[0].id],
      ),
    ).rejects.toThrow("limit reached");
    expect(
      (
        await db.query(
          "select * from staff_profiles where store_id=$1 and role='manager'",
          [independent],
        )
      ).rows,
    ).toHaveLength(3);
  });
  it.each(["manager","receptionist"])("creates a credential-only %s in the selected store and completes personal onboarding without changing assignment", async role => {
    const user="10000000-0000-4000-8000-000000000099";
    await db.exec("reset role; begin");
    try {
      const metadata={greenchoice_role:role,greenchoice_registration:role==="manager"?"franchise_created":"manager_created",greenchoice_store_id:storeA,greenchoice_created_by:fa,greenchoice_manager_id:fa,greenchoice_franchise_id:franchiseA};
      await db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,'employee@example.invalid',$2)",[user,JSON.stringify(metadata)]);
      await db.exec("set role service_role");
      const created=await call(fa,"create_staff",{authUserId:user,storeId:storeA,role});
      const before=(await db.query<{store_id:string;first_name:null; surname:null;phone_number:null;temporary_password_active:boolean;account_setup_complete:boolean}>("select * from staff_profiles where id=$1",[created.rows[0].id])).rows[0];
      expect(before).toMatchObject({store_id:storeA,first_name:null,surname:null,phone_number:null,temporary_password_active:true,account_setup_complete:false});
      if(role==="manager") {
        await db.query("select public.complete_manual_manager_account_setup($1,'Employee','Example','+27821234567','123 Test Road','Pretoria','Gauteng','0001','v1','v1')",[user]);
      } else {
        await identity(user);
        await db.query("select * from public.complete_manager_created_receptionist_setup('Employee','Example','+27821234567','v1','v1')");
      }
      await db.exec("reset role");
      const after=(await db.query<{store_id:string;role:string}>("select * from staff_profiles where id=$1",[created.rows[0].id])).rows[0];
      expect(after).toMatchObject({store_id:storeA,role,first_name:"Employee",surname:"Example",phone_number:"+27821234567",temporary_password_active:false,account_setup_complete:true,profile_setup_complete:true});
    } finally { await db.exec("rollback"); }
  });
  it.each(["store","franchise","creator","registration"])("rejects mismatched %s identity during assigned manager onboarding", async field => {
    const user="10000000-0000-4000-8000-000000000099";
    await db.exec("reset role; begin");
    try {
      const metadata:Record<string,string>={greenchoice_role:"manager",greenchoice_registration:"franchise_created",greenchoice_store_id:storeA,greenchoice_created_by:fa,greenchoice_franchise_id:franchiseA};
      await db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,'employee@example.invalid',$2)",[user,JSON.stringify(metadata)]);
      await db.exec("set role service_role");
      await call(fa,"create_staff",{authUserId:user,storeId:storeA,role:"manager"});
      await db.exec("reset role");
      metadata[{store:"greenchoice_store_id",franchise:"greenchoice_franchise_id",creator:"greenchoice_created_by",registration:"greenchoice_registration"}[field]!]=field==="registration"?"manual":other;
      await db.query("update auth.users set raw_app_meta_data=$2 where id=$1",[user,JSON.stringify(metadata)]);
      await db.exec("set role service_role");
      await expect(db.query("select public.complete_manual_manager_account_setup($1,'Employee','Example','+27821234567','123 Test Road','Pretoria','Gauteng','0001','v1','v1')",[user])).rejects.toThrow("Assigned manager account setup is not available");
    } finally { await db.exec("rollback"); }
  });
  it("preserves storeless manager onboarding and keeps completion service-only", async () => {
    const user="10000000-0000-4000-8000-000000000099";
    await db.exec("reset role; begin");
    try {
      await db.query("insert into auth.users(id,email) values($1,'manual@example.invalid')",[user]);
      await db.query("insert into staff_profiles(auth_user_id,role,temporary_password_active) values($1,'manager',true)",[user]);
      const signature="public.complete_manual_manager_account_setup(uuid,text,text,text,text,text,text,text,text,text)";
      expect((await db.query<{allowed:boolean}>("select has_function_privilege('authenticated',$1,'execute') allowed",[signature])).rows[0].allowed).toBe(false);
      await db.exec("set role service_role");
      await db.query("select public.complete_manual_manager_account_setup($1,'Employee','Example','+27821234567','123 Test Road','Pretoria','Gauteng','0001','v1','v1')",[user]);
      expect((await db.query("select store_id,temporary_password_active,account_setup_complete from staff_profiles where auth_user_id=$1",[user])).rows[0]).toEqual({store_id:null,temporary_password_active:false,account_setup_complete:true});
    } finally { await db.exec("rollback"); }
  });
  it("preserves independent store visibility for non-FA roles", async () => {
    await identity(admin);
    expect(
      (await db.query("select * from stores where franchise_id is null")).rows,
    ).toHaveLength(1);
  });
  it("finds earliest recorded history under RLS, retaining cancelled/refunded history without foreign or future rows", async () => {
    await db.exec("reset role; begin");
    try {
      await db.exec(`insert into pos_sales(store_id,status,total,created_at) values
        ('${storeB}','completed',999,'2000-01-01T00:00:00Z'),
        ('${storeA}','cancelled',999,'2020-01-01T22:00:00Z'),
        ('${storeA}','refunded',999,'2021-01-01T00:00:00Z'),
        ('${storeA}','completed',20,'2024-02-01T22:00:00Z'),
        ('${storeA}','completed',999,'2030-01-01T00:00:00Z');`);
      await identity(fa);
      const query = `select (s.created_at at time zone 'Africa/Johannesburg')::date::text as day
        from pos_sales s join stores st on st.id=s.store_id
        where st.franchise_id=$1 and s.created_at<='2026-10-13T12:00:00Z'
        order by s.created_at asc limit 1`;
      expect((await db.query<{ day: string }>(query, [franchiseA])).rows).toEqual([{ day: "2020-01-02" }]);
      expect((await db.query(query, [franchiseB])).rows).toEqual([]);
    } finally { await db.exec("rollback; reset role"); }
  });
  it("aggregates cents and transactions under RLS, rejecting forged franchises and stores", async () => {
    await db.exec("reset role; begin");
    try {
      await db.exec(`insert into pos_sales(store_id,status,total,refunded_amount,created_at) values
        ('${storeA}','completed',12.345,0,'2026-10-01T21:59:59Z'),
        ('${storeA}','completed',0.105,0,'2026-10-01T21:59:59Z'),
        ('${storeA}','completed',20,5,'2026-10-01T22:00:00Z'),
        ('${storeA}','cancelled',999,0,'2026-10-02T12:00:00Z'),
        ('${storeB}','completed',99999,0,'2026-10-02T12:00:00Z');
        insert into pos_customers(store_id,deleted_at) values ('${storeA}',null),('${storeA}',now()),('${storeB}',null);`);
      await identity(fa);
      const query =
        "select franchise_dashboard_totals_v2($1,'2026-09-30T22:00:00Z','2026-10-02T22:00:00Z',$2) as totals";
      const result = await db.query<{
        totals: { daily: unknown[]; customers: unknown[] };
      }>(query, [franchiseA, null]);
      expect(result.rows[0].totals).toEqual({
        daily: [
          {
            store_id: storeA,
            day: "2026-10-01",
            revenue: 12.46,
            transactions: 2,
          },
          { store_id: storeA, day: "2026-10-02", revenue: 15, transactions: 1 },
        ],
        customers: [{ store_id: storeA, count: 1 }],
      });
      const fastQuery = query.replace("franchise_dashboard_totals_v2(", "franchise_dashboard_totals_v3(");
      expect((await db.query(fastQuery, [franchiseA, null])).rows[0]).toEqual(result.rows[0]);
      const scoped = await db.query<{ totals: { daily: unknown[]; customers: unknown[] } }>(
        "select franchise_dashboard_totals_v3($1,'2026-09-30T22:00:00Z','2026-10-02T22:00:00Z',$2,false) as totals",
        [franchiseA, storeA],
      );
      expect(scoped.rows[0].totals.customers).toEqual([]);
      expect(scoped.rows[0].totals.daily).toEqual(result.rows[0].totals.daily);
      // Use savepoints: PostgreSQL errors otherwise abort this fixture transaction.
      await db.exec("savepoint denied");
      await expect(db.query(query, [franchiseB, null])).rejects.toThrow(
        "Franchise access denied",
      );
      await db.exec("rollback to savepoint denied");
      await expect(db.query(query, [franchiseA, storeB])).rejects.toThrow(
        "Store access denied",
      );
      await db.exec("rollback to savepoint denied");
      await expect(db.query(fastQuery, [franchiseB, null])).rejects.toThrow("Franchise access denied");
      await db.exec("rollback to savepoint denied");
      await expect(db.query(fastQuery, [franchiseA, storeB])).rejects.toThrow("Store access denied");
    } finally {
      await db.exec("rollback; reset role");
    }
  });
  it("fails closed when the FA is restricted", async () => {
    await db.exec(
      `reset role;update staff_profiles set account_status='restricted' where auth_user_id='${fa}'`,
    );
    await identity(fa);
    expect((await db.query("select * from stores")).rows).toHaveLength(0);
    await expect(
      db.query(
        "select franchise_dashboard_totals($1,now()-interval '1 day',now())",
        [franchiseA],
      ),
    ).rejects.toThrow("Franchise access denied");
    await expect(
      db.query("select franchise_dashboard_totals_v3($1,now()-interval '1 day',now())", [franchiseA]),
    ).rejects.toThrow("Franchise access denied");
    await db.exec("reset role;set role service_role");
    await expect(call(fa, "create_store", {})).rejects.toThrow("Access denied");
  });
});
