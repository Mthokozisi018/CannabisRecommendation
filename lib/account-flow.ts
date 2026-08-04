export type AccountFlowProfile = {
  role: "admin" | "manager" | "receptionist";
  store_id?: string | null;
  account_status?: "active" | "restricted" | "deactivated" | "deleted" | null;
  is_active?: boolean | null;
  stores?: { store_access_status?: "active" | "restricted" | null } | Array<{ store_access_status?: "active" | "restricted" | null }> | null;
};

export type AccountAccessDenialReason =
  | "missing_profile"
  | "account_restricted"
  | "account_inactive"
  | "account_deleted"
  | "store_unassigned"
  | "store_restricted";

export type AccountAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: AccountAccessDenialReason; message: string };

function profileStore(profile: AccountFlowProfile) {
  return Array.isArray(profile.stores) ? profile.stores[0] ?? null : profile.stores ?? null;
}

function accountStatus(profile: AccountFlowProfile) {
  return profile.account_status ?? (profile.is_active ? "active" : "deactivated");
}

export function decideAccountAccess(profile: AccountFlowProfile | null | undefined): AccountAccessDecision {
  if (!profile) {
    return { allowed: false, reason: "missing_profile", message: "This account has not been authorized for GreenChoice. Contact the administrator." };
  }

  const status = accountStatus(profile);
  if (status === "restricted") {
    return { allowed: false, reason: "account_restricted", message: "This account has been restricted. Please contact your administrator or GreenChoice support." };
  }
  if (status === "deleted") {
    return { allowed: false, reason: "account_deleted", message: "This account is no longer available. Please contact your administrator." };
  }
  if (status !== "active") {
    return { allowed: false, reason: "account_inactive", message: "Your account is inactive. Please contact your manager." };
  }

  if (profile.role === "manager" && !profile.store_id) {
    return { allowed: true };
  }
  if (profile.role !== "admin" && !profile.store_id) {
    return { allowed: false, reason: "store_unassigned", message: "Your account is not assigned to an active store. Please contact your administrator." };
  }
  if (profile.role !== "admin" && profileStore(profile)?.store_access_status !== "active") {
    return { allowed: false, reason: "store_restricted", message: "Access to this store has been restricted. Please contact your administrator or GreenChoice support." };
  }

  return { allowed: true };
}

export function managerLoginDestination(session: {
  accountSetupComplete: boolean;
  storeSetupComplete: boolean;
  onboardingCompleteSeen: boolean;
}) {
  if (!session.accountSetupComplete) return "/manager/setup/account";
  if (!session.storeSetupComplete) return "/manager/setup/store";
  if (!session.onboardingCompleteSeen) return "/manager/setup/complete";
  return "/dashboard/manager";
}
