import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

// Execute the actual new migration in an isolated PostgreSQL engine. Scaffolding
// mirrors pre-existing tables/roles, without connecting to anyone's Supabase data.
let db: PGlite;
const storeA = "11111111-1111-4111-8111-111111111111";
const storeB = "22222222-2222-4222-8222-222222222222";
const tokenA = "a".repeat(64), tokenB = "b".repeat(64);
const submission = "33333333-3333-4333-8333-333333333333";
const hash = "c".repeat(64);
function args(token = tokenA, id = submission, phone = "0821234567", payloadHash = hash, age = true, terms = true) {
  return [token, id, payloadHash, "Test Customer", "test@example.invalid", `+27${phone.slice(1)}`, phone, phone,
    "passport", "d".repeat(64), "3456", true, age, terms, true, true, "2026-10-07", false, []];
}
const call = `select public.complete_qr_customer_registration(${Array.from({ length: 19 }, (_, i) => `$${i + 1}`).join(",")}) as id`;
describe("atomic store QR migration", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema storage; create schema extensions;
      -- Deterministic test-only replacement for pgcrypto random bytes; never deployed.
      create function extensions.gen_random_bytes(n integer) returns bytea language sql as
        $$ select decode(repeat(md5(random()::text), (n+15)/16), 'hex') $$;
      create table public.stores(id uuid primary key, name text, is_active boolean default true, store_access_status text default 'active');
      create table public.pos_customers(id uuid primary key default gen_random_uuid(), store_id uuid references public.stores,
        first_name text not null, surname text not null, full_name text not null, phone_normalized text not null,
        phone_digits text not null, phone_display text not null, deleted_at timestamptz,
        unique(store_id,phone_normalized));
      alter table public.pos_customers enable row level security;
      create table public.pos_sales(id uuid primary key default gen_random_uuid(), store_id uuid references public.stores, customer_id uuid references public.pos_customers);
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text);
      alter table storage.objects enable row level security;
      grant usage on schema public,storage,extensions to anon,authenticated,service_role;
      grant all on public.pos_customers,public.pos_sales,public.stores,storage.buckets,storage.objects to service_role;
      insert into public.stores(id,name) values('${storeA}','Store A'),('${storeB}','Store B');
    `);
    // QR-only setup may be applied before the remaining registration migration.
    await db.exec(readFileSync("supabase/migrations/20261007134647_store_registration_qr_tokens.sql", "utf8"));
    const beforeTokens = await db.query("select store_id,token from public.store_registration_tokens order by store_id");
    await db.exec(readFileSync("supabase/migrations/20261007130205_store_qr_customer_registration.sql", "utf8"));
    expect((await db.query("select store_id,token from public.store_registration_tokens order by store_id")).rows).toEqual(beforeTokens.rows);
    await db.exec(readFileSync("supabase/migrations/20261007134647_store_registration_qr_tokens.sql", "utf8"));
    const afterTokens = await db.query("select store_id,token from public.store_registration_tokens order by store_id");
    expect(afterTokens.rows).toEqual(beforeTokens.rows);
    await db.query("update public.store_registration_tokens set token=$1 where store_id=$2", [tokenA, storeA]);
    await db.query("update public.store_registration_tokens set token=$1 where store_id=$2", [tokenB, storeB]);
    await db.exec("set role service_role");
  }, 30_000);
  afterAll(async () => { await db?.close(); });
  it("creates the existing POS customer and consent evidence together", async () => {
    const result = await db.query<{ id: string }>(call, args());
    const row = await db.query<{ store_id: string; marketing: boolean; document_last_four: string }>("select store_id,marketing,document_last_four from public.qr_customer_registrations where id=$1", [submission]);
    expect(result.rows[0].id).toBeTruthy(); expect(row.rows[0]).toEqual({ store_id: storeA, marketing: false, document_last_four: "3456" });
  });
  it("replays the same submission without duplicates and rejects changed requests", async () => {
    const first = await db.query(call, args()); const replay = await db.query(call, args());
    expect(replay.rows).toEqual(first.rows);
    await expect(db.query(call, args(tokenA, submission, "0821234567", "e".repeat(64)))).rejects.toThrow("request changed");
    const count = await db.query<{ count: number }>("select count(*)::int as count from public.pos_customers where store_id=$1", [storeA]); expect(count.rows[0].count).toBe(1);
  });
  it("blocks duplicates without account takeover, but allows independent registration in another store", async () => {
    await expect(db.query(call, args(tokenA, "44444444-4444-4444-8444-444444444444"))).rejects.toThrow("assistance");
    await expect(db.query(call, args(tokenB, "55555555-5555-4555-8555-555555555555"))).resolves.toBeTruthy();
  });
  it("rejects invalid, revoked, expired, inactive and restricted stores", async () => {
    await expect(db.query(call, args("z".repeat(64)))).rejects.toThrow("link unavailable");
    for (const change of ["revoked_at=now()", "expires_at=now()-interval '1 minute'"]) {
      await db.exec(`update public.store_registration_tokens set ${change} where store_id='${storeA}'`);
      await expect(db.query(call, args())).rejects.toThrow("link unavailable");
      await db.exec(`update public.store_registration_tokens set revoked_at=null,expires_at=null where store_id='${storeA}'`);
    }
    for (const change of ["is_active=false", "store_access_status='restricted'"]) {
      await db.exec(`update public.stores set ${change} where id='${storeA}'`);
      await expect(db.query(call, args())).rejects.toThrow("link unavailable");
      await db.exec(`update public.stores set is_active=true,store_access_status='active' where id='${storeA}'`);
    }
  });
  it("rolls back without customer creation when age or acknowledgements fail", async () => {
    const id = "66666666-6666-4666-8666-666666666666";
    await expect(db.query(call, args(tokenA, id, "0831234567", hash, false))).rejects.toThrow("incomplete");
    await expect(db.query(call, args(tokenA, id, "0831234567", hash, true, false))).rejects.toThrow("incomplete");
    const count = await db.query<{ count: number }>("select count(*)::int as count from public.pos_customers where phone_digits='0831234567'"); expect(count.rows[0].count).toBe(0);
  });
  it("rejects cross-store sale linkage including modified privileged requests", async () => {
    const customer = (await db.query<{ id: string }>(call, args())).rows[0].id;
    await expect(db.query("insert into public.pos_sales(store_id,customer_id) values($1,$2)", [storeB, customer])).rejects.toThrow("does not belong");
    await expect(db.query("insert into public.pos_sales(store_id,customer_id) values($1,$2)", [storeA, customer])).resolves.toBeTruthy();
  });
  it("denies direct browser table and RPC access, and storage policies cannot expose the bucket", async () => {
    await db.exec("reset role; grant select on storage.objects to authenticated; create policy broad_existing_read on storage.objects for select to authenticated using(true); insert into storage.objects(bucket_id) values('registration-documents'),('public-images'); set role authenticated;");
    try {
      await expect(db.query("select * from public.qr_customer_registrations")).rejects.toThrow("permission denied");
      await expect(db.query("select * from public.store_registration_tokens")).rejects.toThrow("permission denied");
      await expect(db.query(call, args())).rejects.toThrow("permission denied");
      const visible = await db.query<{ bucket_id: string }>("select bucket_id from storage.objects");
      expect(visible.rows).toEqual([{ bucket_id: "public-images" }]);
    } finally { await db.exec("reset role; set role service_role"); }
  });
  it("rehearses the encrypted-object bucket migration without deleting existing evidence", async () => {
    const before = await db.query<{ count: number }>("select count(*)::int as count from public.qr_customer_registrations");
    await db.exec(readFileSync("supabase/migrations/20261024120000_encrypt_temporary_registration_documents.sql", "utf8"));
    const bucket = await db.query<{ public: boolean; file_size_limit: number; allowed_mime_types: string[] }>(
      "select public,file_size_limit,allowed_mime_types from storage.buckets where id='registration-documents'");
    expect(bucket.rows[0]).toEqual({ public: false, file_size_limit: 6291520, allowed_mime_types: ["application/octet-stream", "image/jpeg"] });
    const after = await db.query<{ count: number }>("select count(*)::int as count from public.qr_customer_registrations");
    expect(after.rows).toEqual(before.rows);
    await db.exec(readFileSync("supabase/migrations/20261024120000_encrypt_temporary_registration_documents.sql", "utf8"));
  });
});
