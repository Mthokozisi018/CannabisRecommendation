import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { DashboardSession } from "@/lib/dashboard-session";
import { BILLING_PRICES_CENTS, franchiseMonthlyPriceCents } from "./pricing";

export type BillingAccount = {
  id: string;
  store_id: string | null;
  franchise_id: string | null;
  owner_profile_id: string;
  status: "onboarding_due" | "active" | "grace" | "restricted" | "cancelled";
  onboarding_paid_at: string | null;
  grace_ends_at: string | null;
};

export function billingEnabled() {
  return (process.env.GREENCHOICE_ENV === "staging" || process.env.GREENCHOICE_ENV === "production")
    && process.env.PAYSTACK_BILLING_ENABLED === "true"
    && process.env.PAYSTACK_MODE === "test"
    && Boolean(process.env.PAYSTACK_SECRET_KEY?.trim().startsWith("sk_test_"));
}

function db() {
  const client = createSupabaseAdminClient();
  if (!client) throw new Error("Billing database is unavailable.");
  return client;
}

export async function billableStoreCount(franchiseId: string) {
  const { count, error } = await db().from("stores").select("id", { count: "exact", head: true })
    .eq("franchise_id", franchiseId).eq("is_active", true);
  if (error || count === null) throw new Error("Could not calculate franchise billing.");
  return count;
}

export async function currentMonthlyPrice(account: BillingAccount) {
  if (!account.franchise_id) return { count: 1, amountCents: BILLING_PRICES_CENTS.independentMonthly };
  const count = await billableStoreCount(account.franchise_id);
  return { count, amountCents: franchiseMonthlyPriceCents(count) };
}

export async function billingAccountForSession(session: DashboardSession, create = false): Promise<BillingAccount | null> {
  if (!billingEnabled()) return null;
  const client = db();
  const franchiseId = session.normalizedRole === "franchise_admin" ? session.profile.franchise_id : null;
  const storeId = session.normalizedRole === "manager" ? session.assignedStoreId : null;
  if (!franchiseId && !storeId) return null;
  if (franchiseId && !session.accountSetupComplete) return null;
  if (storeId && (!session.accountSetupComplete || !session.storeSetupComplete)) return null;
  if (storeId) {
    const { data: store, error } = await client.from("stores").select("franchise_id").eq("id", storeId).single();
    if (error || store.franchise_id) return null;
  }
  const column = franchiseId ? "franchise_id" : "store_id";
  const organizationId = franchiseId ?? storeId;
  const { data: existing, error } = await client.from("billing_accounts").select("id,store_id,franchise_id,owner_profile_id,status,onboarding_paid_at,grace_ends_at")
    .eq(column, organizationId!).maybeSingle<BillingAccount>();
  if (error) throw new Error("Billing account could not be loaded.");
  if (existing || !create) return existing;
  // The first assigned independent manager owns billing until an explicit transfer.
  if (storeId) {
    const { data: first, error: ownerError } = await client.from("staff_profiles").select("id")
      .eq("store_id", storeId).eq("role", "manager").order("created_at", { ascending: true }).limit(1).single();
    if (ownerError || first.id !== session.staffProfileId) return null;
  }
  const { data: inserted, error: insertError } = await client.from("billing_accounts")
    .insert({ store_id: storeId ?? null, franchise_id: franchiseId ?? null, owner_profile_id: session.staffProfileId })
    .select("id,store_id,franchise_id,owner_profile_id,status,onboarding_paid_at,grace_ends_at").single<BillingAccount>();
  if (!insertError) return inserted;
  if (insertError.code !== "23505") throw new Error("Billing account could not be created.");
  const { data: raced, error: racedError } = await client.from("billing_accounts").select("id,store_id,franchise_id,owner_profile_id,status,onboarding_paid_at,grace_ends_at")
    .eq(column, organizationId!).single<BillingAccount>();
  if (racedError) throw new Error("Billing account could not be loaded.");
  return raced;
}

export async function requireBillingOwner(session: DashboardSession, create = false) {
  const account = await billingAccountForSession(session, create);
  if (!account || account.owner_profile_id !== session.staffProfileId) throw new Error("Billing owner access is required.");
  return account;
}

export function billingDb() { return db(); }

export async function billingAccessForSession(session: DashboardSession): Promise<"allowed" | "owner_due" | "staff_restricted"> {
  if (!billingEnabled() || session.profile.role === "admin") return "allowed";
  if (!session.accountSetupComplete) return "allowed";
  if (session.normalizedRole === "manager" && !session.storeSetupComplete) return "allowed";
  if (!session.profile.franchise_id && !session.assignedStoreId) return "allowed";
  const client = db();
  let account: BillingAccount | null = null;
  if (session.normalizedRole === "franchise_admin" || session.normalizedRole === "manager") {
    account = await billingAccountForSession(session, session.normalizedRole === "franchise_admin" || session.normalizedRole === "manager");
  }
  if (!account && session.assignedStoreId) {
    const { data: store, error } = await client.from("stores").select("franchise_id").eq("id", session.assignedStoreId).single();
    if (error) throw new Error("Billing access could not be checked.");
    const { data, error: accountError } = await client.from("billing_accounts")
      .select("id,store_id,franchise_id,owner_profile_id,status,onboarding_paid_at,grace_ends_at")
      .eq(store.franchise_id ? "franchise_id" : "store_id", store.franchise_id ?? session.assignedStoreId)
      .maybeSingle<BillingAccount>();
    if (accountError) throw new Error("Billing access could not be checked.");
    account = data;
  }
  if (account?.status === "active") return "allowed";
  if (account?.status === "grace" && account.grace_ends_at && new Date(account.grace_ends_at).getTime() > Date.now()) return "allowed";
  return account?.owner_profile_id === session.staffProfileId ? "owner_due" : "staff_restricted";
}
