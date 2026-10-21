import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

let db: PGlite;
const paidAt = "2026-10-21T10:00:00Z";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role service_role;
    create role anon;
    create role authenticated;
    create table public.franchises(id uuid primary key);
    create table public.stores(id uuid primary key, franchise_id uuid, is_active boolean not null default true);
    create table public.billing_accounts(
      id uuid primary key, store_id uuid, franchise_id uuid, owner_profile_id uuid not null,
      status text not null default 'onboarding_due', onboarding_paid_at timestamptz,
      grace_ends_at timestamptz, updated_at timestamptz not null default now()
    );
    create table public.billing_payments(
      id uuid primary key, account_id uuid not null, reference text not null unique,
      payer_email text not null, provider_transaction_id bigint unique,
      purpose text not null, amount_cents integer not null, status text not null default 'pending',
      paid_at timestamptz, updated_at timestamptz not null default now()
    );
    create table public.billing_subscriptions(
      id uuid primary key default gen_random_uuid(), account_id uuid not null unique,
      paystack_customer_code text, authorization_code text, card_last4 text, card_brand text,
      monthly_amount_cents integer not null, billable_store_count integer not null,
      status text not null, first_due_at timestamptz, next_payment_at timestamptz,
      last_paid_at timestamptz, failed_at timestamptz, updated_at timestamptz not null default now()
    );
  `);
  try {
    await db.exec(readFileSync("supabase/migrations/20261021095816_20261021130000_initial_month_in_onboarding.sql", "utf8"));
  } catch (error) {
    throw new Error("Initial-month migration failed", { cause: error });
  }
  await db.exec(`
    insert into public.billing_accounts(id,store_id,owner_profile_id) values
      ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000301');
    insert into public.billing_accounts(id,franchise_id,owner_profile_id) values
      ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000302'),
      ('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000303'),
      ('00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000205','00000000-0000-0000-0000-000000000305');
    insert into public.billing_accounts(id,franchise_id,owner_profile_id,status,onboarding_paid_at) values
      ('00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000204',
       '00000000-0000-0000-0000-000000000304','active','2026-10-20T10:00:00Z');
    insert into public.billing_payments(id,account_id,reference,payer_email,purpose,amount_cents,initial_monthly_amount_cents,initial_billable_store_count) values
      ('00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000101','manager-new','m@example.test','onboarding',400000,150000,1),
      ('00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000102','franchise-new','f@example.test','onboarding',700000,250000,1),
      ('00000000-0000-0000-0000-000000000405','00000000-0000-0000-0000-000000000105','franchise-three-stores','three@example.test','onboarding',900000,450000,3);
    insert into public.billing_payments(id,account_id,reference,payer_email,purpose,amount_cents) values
      ('00000000-0000-0000-0000-000000000403','00000000-0000-0000-0000-000000000103','franchise-legacy','old@example.test','onboarding',450000);
    insert into public.billing_payments(id,account_id,reference,payer_email,purpose,amount_cents,status,provider_transaction_id,paid_at) values
      ('00000000-0000-0000-0000-000000000404','00000000-0000-0000-0000-000000000104','franchise-already-paid',
       'paid@example.test','onboarding',450000,'success',1004,'2026-10-20T10:00:00Z');
    insert into public.billing_subscriptions(account_id,monthly_amount_cents,billable_store_count,status,first_due_at,next_payment_at)
      values('00000000-0000-0000-0000-000000000104',230000,1,'active','2026-11-20T10:00:00Z','2026-11-20T10:00:00Z');
  `);
});
afterAll(async () => { await db?.close(); });

async function record(reference: string, providerId: number) {
  return db.query<{ record_verified_billing_payment: string }>(
    "select public.record_verified_billing_payment($1,$2,$3,'CUS_test','AUTH_test','4242','visa')",
    [reference, providerId, paidAt],
  );
}

it("records the manager's R4,000 and franchise's R7,000 as the first month paid, with renewal next month", async () => {
  await record("manager-new", 1001);
  await record("franchise-new", 1002);
  const result = await db.query<{ amount_cents: number; monthly_amount_cents: number; status: string; last_paid_at: string; next_payment_at: string }>(`
    select p.amount_cents,s.monthly_amount_cents,a.status,s.last_paid_at,s.next_payment_at
    from public.billing_payments p join public.billing_accounts a on a.id=p.account_id
    join public.billing_subscriptions s on s.account_id=a.id
    where p.reference in ('manager-new','franchise-new') order by p.amount_cents
  `);
  expect(result.rows.map(row => [row.amount_cents, row.monthly_amount_cents, row.status])).toEqual([
    [400000,150000,"active"],[700000,250000,"active"],
  ]);
  expect(result.rows.every(row => new Date(row.last_paid_at).toISOString() === paidAt.replace("Z", ".000Z"))).toBe(true);
  expect(result.rows.every(row => new Date(row.next_payment_at).toISOString() === "2026-11-21T10:00:00.000Z")).toBe(true);
  await record("manager-new", 1001);
  await record("franchise-new", 1002);
  const count = await db.query<{ account_id: string; count: number }>(`
    select account_id,count(*)::integer as count from public.billing_subscriptions
    where account_id in ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000102')
    group by account_id order by account_id
  `);
  expect(count.rows.map(row => row.count)).toEqual([1, 1]);
});

it("rejects a conflicting replay and preserves the older onboarding-only arrangement", async () => {
  await expect(record("manager-new", 9999)).rejects.toThrow(/Transaction reference conflict/);
  await record("franchise-legacy", 1003);
  const result = await db.query<{ amount_cents: number; monthly_amount_cents: number; last_paid_at: string | null }>(`
    select p.amount_cents,s.monthly_amount_cents,s.last_paid_at
    from public.billing_payments p join public.billing_subscriptions s on s.account_id=p.account_id
    where p.reference='franchise-legacy'
  `);
  expect(result.rows[0]).toMatchObject({ amount_cents: 450000, monthly_amount_cents: 250000, last_paid_at: null });
  await record("franchise-already-paid", 1004);
  const existing = await db.query<{ monthly_amount_cents: number; next_payment_at: string }>(
    "select monthly_amount_cents,next_payment_at from public.billing_subscriptions where account_id='00000000-0000-0000-0000-000000000104'",
  );
  expect(existing.rows[0].monthly_amount_cents).toBe(230000);
  expect(new Date(existing.rows[0].next_payment_at).toISOString()).toBe("2026-11-20T10:00:00.000Z");
});

it("records additional stores in the first month and never reopens an already paid onboarding", async () => {
  await record("franchise-three-stores", 1005);
  const charged = await db.query<{ amount_cents: number; monthly_amount_cents: number; last_paid_at: string; first_due_at: string }>(`
    select p.amount_cents,s.monthly_amount_cents,s.last_paid_at,s.first_due_at
    from public.billing_payments p join public.billing_subscriptions s on s.account_id=p.account_id
    where p.reference='franchise-three-stores'
  `);
  expect(charged.rows[0].amount_cents).toBe(900000);
  expect(charged.rows[0].monthly_amount_cents).toBe(450000);
  expect(new Date(charged.rows[0].last_paid_at).toISOString()).toBe("2026-10-21T10:00:00.000Z");
  expect(new Date(charged.rows[0].first_due_at).toISOString()).toBe("2026-11-21T10:00:00.000Z");
  await db.exec(`
    insert into public.billing_payments(id,account_id,reference,payer_email,purpose,amount_cents,
      initial_monthly_amount_cents,initial_billable_store_count) values
      ('00000000-0000-0000-0000-000000000406','00000000-0000-0000-0000-000000000105',
       'franchise-repeat','three@example.test','onboarding',900000,450000,3)
  `);
  await expect(record("franchise-repeat", 1006)).rejects.toThrow(/Onboarding was already paid/);
  const repeat = await db.query<{ status: string }>("select status from public.billing_payments where reference='franchise-repeat'");
  expect(repeat.rows[0].status).toBe("pending");
});
