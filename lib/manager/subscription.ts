import "server-only";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import type { DashboardSession } from "@/lib/dashboard-session";
import { getDashboardSession } from "@/lib/dashboard-session";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type ManagerSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "grace_period"
  | "restricted"
  | "canceled"
  | "incomplete"
  | "unpaid";

export type ManagerSubscriptionRecord = {
  id: string;
  store_id: string;
  manager_auth_user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_price_id: string | null;
  status: ManagerSubscriptionStatus;
  trial_started_at: string;
  trial_ends_at: string;
  current_period_ends_at: string | null;
  payment_method_ready: boolean;
  grace_period_ends_at: string | null;
  last_payment_failed_at: string | null;
  last_payment_succeeded_at: string | null;
  created_at: string;
  updated_at: string;
};

const SUBSCRIPTION_SELECT =
  "id, store_id, manager_auth_user_id, stripe_customer_id, stripe_subscription_id, stripe_checkout_session_id, stripe_price_id, status, trial_started_at, trial_ends_at, current_period_ends_at, payment_method_ready, grace_period_ends_at, last_payment_failed_at, last_payment_succeeded_at, created_at, updated_at";

const DAY_MS = 24 * 60 * 60 * 1000;

function missingSubscriptionTable(error: PostgrestError | null) {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || error.message.includes("manager_subscriptions");
}

async function readSubscription(storeId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { storageReady: false as const, record: null };
  const { data, error } = await admin
    .from("manager_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("store_id", storeId)
    .maybeSingle<ManagerSubscriptionRecord>();

  if (missingSubscriptionTable(error)) return { storageReady: false as const, record: null };
  if (error) throw new Error(error.message);
  return { storageReady: true as const, record: data ?? null };
}

async function managerForStore(storeId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("staff_profiles")
    .select("auth_user_id")
    .eq("store_id", storeId)
    .eq("role", "manager")
    .neq("account_status", "deleted")
    .limit(1)
    .maybeSingle<{ auth_user_id: string }>();
  if (error) throw new Error(error.message);
  return data?.auth_user_id ?? null;
}

export async function ensureStoreSubscription(storeId: string, managerAuthUserId?: string | null) {
  const existing = await readSubscription(storeId);
  if (!existing.storageReady || existing.record) return existing;

  const admin = createSupabaseAdminClient();
  if (!admin) return { storageReady: false as const, record: null };
  const managerId = managerAuthUserId || await managerForStore(storeId);
  if (!managerId) return { storageReady: true as const, record: null };

  const trialStartedAt = new Date();
  const trialEndsAt = new Date(trialStartedAt.getTime() + 30 * DAY_MS);
  const { data, error } = await admin
    .from("manager_subscriptions")
    .insert({
      store_id: storeId,
      manager_auth_user_id: managerId,
      status: "trialing",
      trial_started_at: trialStartedAt.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      payment_method_ready: false,
      updated_at: trialStartedAt.toISOString()
    })
    .select(SUBSCRIPTION_SELECT)
    .single<ManagerSubscriptionRecord>();

  if (error?.code === "23505") return readSubscription(storeId);
  if (missingSubscriptionTable(error)) return { storageReady: false as const, record: null };
  if (error) throw new Error(error.message);
  return { storageReady: true as const, record: data };
}

async function updateSubscription(id: string, values: Record<string, unknown>) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("manager_subscriptions")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(SUBSCRIPTION_SELECT)
    .single<ManagerSubscriptionRecord>();
  if (missingSubscriptionTable(error)) return null;
  if (error) throw new Error(error.message);
  return data;
}

export async function getManagerSubscriptionOverview(session: Pick<DashboardSession, "storeId" | "authUserId">) {
  return ensureStoreSubscription(session.storeId, session.authUserId);
}

export async function enforceStoreSubscriptionAccess(storeId: string, managerAuthUserId?: string | null) {
  const state = await ensureStoreSubscription(storeId, managerAuthUserId);
  let record = state.record;
  if (!state.storageReady || !record) return { allowed: true, status: record?.status ?? null, storageReady: state.storageReady };

  const now = Date.now();
  const trialEndsAt = new Date(record.trial_ends_at).getTime();
  const graceEndsAt = record.grace_period_ends_at ? new Date(record.grace_period_ends_at).getTime() : null;

  if (record.status === "restricted" || record.status === "unpaid" || record.status === "canceled") {
    return { allowed: false, status: record.status, storageReady: true };
  }

  if (record.status === "trialing" && Number.isFinite(trialEndsAt) && trialEndsAt <= now) {
    const derivedGraceEnd = trialEndsAt + 4 * DAY_MS;
    if (derivedGraceEnd <= now) {
      record = await updateSubscription(record.id, {
        status: "restricted",
        grace_period_ends_at: new Date(derivedGraceEnd).toISOString()
      }) ?? record;
      return { allowed: false, status: "restricted" as const, storageReady: true };
    }
    record = await updateSubscription(record.id, {
      status: "grace_period",
      grace_period_ends_at: new Date(derivedGraceEnd).toISOString()
    }) ?? record;
  }

  if (record.status === "past_due" && !graceEndsAt) {
    record = await updateSubscription(record.id, {
      status: "grace_period",
      grace_period_ends_at: new Date(now + 4 * DAY_MS).toISOString(),
      last_payment_failed_at: new Date(now).toISOString()
    }) ?? record;
  }

  const effectiveGraceEnd = record.grace_period_ends_at ? new Date(record.grace_period_ends_at).getTime() : null;
  if (record.status === "grace_period" && effectiveGraceEnd !== null && effectiveGraceEnd <= now) {
    await updateSubscription(record.id, { status: "restricted" });
    return { allowed: false, status: "restricted" as const, storageReady: true };
  }

  return { allowed: true, status: record.status, storageReady: true };
}

export async function requireManagerSubscriptionSession() {
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  if (!session.isManager) redirect("/denied" as never);
  if (!session.accountSetupComplete) redirect("/manager/setup/account" as never);
  if (!session.storeSetupComplete) redirect("/manager/setup/store" as never);
  if (!session.onboardingCompleteSeen) redirect("/manager/setup/complete" as never);
  return session;
}

export function subscriptionStatusLabel(status: ManagerSubscriptionStatus | null) {
  switch (status) {
    case "trialing": return "Free Trial";
    case "active": return "Active";
    case "past_due": return "Payment Due";
    case "grace_period": return "Grace Period";
    case "restricted": return "Restricted";
    case "canceled": return "Canceled";
    case "incomplete": return "Setup Required";
    case "unpaid": return "Unpaid";
    default: return "Setup Required";
  }
}
