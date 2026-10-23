import "server-only";
import { billingDb, billingEnabled } from "@/lib/billing/accounts";
import type { DashboardSession } from "@/lib/dashboard-session";
import { logServerEvent } from "@/lib/logger";

/** Only a newly verified initial charge for this manager's billing account qualifies. */
async function checkManagerWelcomeAvailability(session: DashboardSession, requireLoginOffer: boolean): Promise<boolean> {
  if (!billingEnabled() || !session.isManager || !session.onboardingComplete ||
      !session.onboardingCompleteSeen || !session.assignedStoreId || !session.profile.created_at) return false;

  const client = billingDb();
  const { data: store, error: storeError } = await client.from("stores")
    .select("franchise_id").eq("id", session.assignedStoreId).single();
  if (storeError) throw new Error("Manager welcome store could not be checked.");

  const { data: account, error: accountError } = await client.from("billing_accounts")
    .select("id,status,onboarding_paid_at,welcome_available_at")
    .eq(store.franchise_id ? "franchise_id" : "store_id", store.franchise_id ?? session.assignedStoreId)
    .maybeSingle();
  if (accountError) throw new Error("Manager welcome billing account could not be checked.");
  if (!account || account.status !== "active" || !account.onboarding_paid_at || !account.welcome_available_at ||
      new Date(session.profile.created_at).getTime() > new Date(account.onboarding_paid_at).getTime()) return false;

  const [{ data: payment, error: paymentError }, { data: completed, error: completionError }, offerResult] = await Promise.all([
    client.from("billing_payments").select("id").eq("account_id", account.id)
      .eq("purpose", "onboarding").eq("status", "success")
      .not("initial_monthly_amount_cents", "is", null).maybeSingle(),
    client.from("manager_welcome_completions").select("profile_id")
      .eq("profile_id", session.staffProfileId).maybeSingle(),
    requireLoginOffer
      ? client.from("manager_welcome_offers").select("profile_id")
        .eq("profile_id", session.staffProfileId).maybeSingle()
      : Promise.resolve({ data: { profile_id: session.staffProfileId }, error: null })
  ]);
  if (paymentError || completionError || offerResult.error) throw new Error("Manager welcome state could not be checked.");
  return Boolean(payment && !completed && offerResult.data);
}

export async function managerWelcomeIsAvailable(session: DashboardSession, requireLoginOffer = true): Promise<boolean> {
  try {
    return await checkManagerWelcomeAvailability(session, requireLoginOffer);
  } catch (error) {
    await logServerEvent("warn", "manager_welcome_check_unavailable", {
      reason: error instanceof Error ? error.message : "Unknown welcome check failure"
    });
    return false;
  }
}

export async function offerManagerWelcomeAtLogin(session: DashboardSession) {
  if (!await managerWelcomeIsAvailable(session, false)) return;
  try {
    const { error } = await billingDb().from("manager_welcome_offers")
      .upsert({ profile_id: session.staffProfileId }, { onConflict: "profile_id", ignoreDuplicates: true });
    if (error) throw new Error("Manager welcome offer could not be recorded.");
  } catch (error) {
    await logServerEvent("warn", "manager_welcome_offer_unavailable", {
      reason: error instanceof Error ? error.message : "Unknown welcome offer failure"
    });
  }
}
