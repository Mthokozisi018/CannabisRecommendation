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
    create table public.staff_profiles(id uuid primary key);
    create table public.billing_accounts(
      id uuid primary key, status text not null default 'onboarding_due',
      onboarding_paid_at timestamptz
    );
    create table public.billing_payments(
      id uuid primary key, account_id uuid not null,
      purpose text not null, status text not null,
      initial_monthly_amount_cents integer, paid_at timestamptz
    );
    insert into public.staff_profiles values ('00000000-0000-0000-0000-000000000011');
    insert into public.billing_accounts values
      ('00000000-0000-0000-0000-000000000101','active','2026-10-20T10:00:00Z'),
      ('00000000-0000-0000-0000-000000000102','onboarding_due',null),
      ('00000000-0000-0000-0000-000000000103','onboarding_due',null),
      ('00000000-0000-0000-0000-000000000104','onboarding_due',null);
    insert into public.billing_payments values
      ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000102','onboarding','pending',150000,null),
      ('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000103','onboarding','success',null,'2026-10-21T10:00:00Z'),
      ('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000104','onboarding','success',150000,'2026-10-21T10:00:00Z');
  `);
  await db.exec(readFileSync("supabase/migrations/20261021154404_manager_verified_payment_welcome.sql", "utf8"));
});

afterAll(async () => { await db?.close(); });

async function available(accountSuffix: string) {
  const { rows } = await db.query<{ welcome_available_at: string | null }>(
    "select welcome_available_at from public.billing_accounts where id = $1",
    [`00000000-0000-0000-0000-0000000001${accountSuffix}`]
  );
  return rows[0].welcome_available_at;
}

it("does not retroactively welcome existing, pending, or legacy onboarding accounts", async () => {
  expect(await available("01")).toBeNull();
  await db.query("update public.billing_accounts set status='active',onboarding_paid_at=$1 where id='00000000-0000-0000-0000-000000000102'", [paidAt]);
  await db.query("update public.billing_accounts set status='active',onboarding_paid_at=$1 where id='00000000-0000-0000-0000-000000000103'", [paidAt]);
  expect(await available("02")).toBeNull();
  expect(await available("03")).toBeNull();
});

it("opens the welcome only on the verified initial payment transition", async () => {
  await db.query("update public.billing_accounts set status='active',onboarding_paid_at=$1 where id='00000000-0000-0000-0000-000000000104'", [paidAt]);
  expect(await available("04")).not.toBeNull();
  await db.exec("insert into public.manager_welcome_completions(profile_id) values ('00000000-0000-0000-0000-000000000011')");
  await db.exec("insert into public.manager_welcome_offers(profile_id) values ('00000000-0000-0000-0000-000000000011')");
  const { rows } = await db.query<{ completed_at: string }>("select completed_at from public.manager_welcome_completions where profile_id='00000000-0000-0000-0000-000000000011'");
  expect(rows[0].completed_at).toBeTruthy();
});
