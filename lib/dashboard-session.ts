import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { decideAccountAccess, type AccountAccessDecision, type AccountAccessDenialReason } from "@/lib/account-flow";
import { STORE } from "@/lib/data";
import { normalizeRole } from "@/lib/authorization";
import { getSessionState, updateSessionState } from "@/lib/session";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { profileRoleToStaffRole } from "@/lib/staff-profile";
import type { AccountRole, StaffDTO, StaffRole, StoreAccessStatus, StoreMembershipDTO } from "@/lib/types";

const DASHBOARD_PROFILE_SELECT =
  "id, auth_user_id, user_id, store_id, email, full_name, first_name, surname, physical_address, city, province, postal_code, country, mobile_number, phone_number, alternative_phone, employee_id, role, is_active, account_status, account_setup_complete, profile_setup_complete, store_setup_complete, onboarding_completed_at, onboarding_complete_seen_at, temporary_password_active, password_changed_at, terms_accepted_at, privacy_policy_accepted_at, terms_version, privacy_policy_version, stores(id, slug, name, store_access_status, store_information_confirmed_at, store_information_confirmed_by)";

type DashboardStoreRow = {
  id: string;
  slug: string | null;
  name: string | null;
  store_access_status?: StoreAccessStatus | null;
  store_information_confirmed_at?: string | null;
  store_information_confirmed_by?: string | null;
};

export type DashboardStaffProfile = {
  id: string;
  auth_user_id: string;
  user_id?: string | null;
  store_id?: string | null;
  email: string;
  full_name?: string | null;
  first_name?: string | null;
  surname?: string | null;
  physical_address?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  mobile_number?: string | null;
  phone_number?: string | null;
  alternative_phone?: string | null;
  employee_id?: string | null;
  role: "admin" | "manager" | "receptionist";
  is_active?: boolean | null;
  account_status?: "active" | "restricted" | "deactivated" | "deleted" | null;
  account_setup_complete?: boolean | null;
  profile_setup_complete?: boolean | null;
  store_setup_complete?: boolean | null;
  onboarding_completed_at?: string | null;
  onboarding_complete_seen_at?: string | null;
  temporary_password_active?: boolean | null;
  password_changed_at?: string | null;
  terms_accepted_at?: string | null;
  privacy_policy_accepted_at?: string | null;
  terms_version?: string | null;
  privacy_policy_version?: string | null;
  stores?: DashboardStoreRow | DashboardStoreRow[] | null;
};

export type DashboardSession = {
  user: User;
  authUserId: string;
  staffProfileId: string;
  email: string;
  displayName: string;
  role: StaffRole;
  normalizedRole: AccountRole;
  accountStatus: "active" | "restricted" | "deactivated" | "deleted";
  assignedStoreId: string | null;
  storeId: string;
  storeName: string;
  storeSlug: string;
  storeAccessStatus: StoreAccessStatus;
  accountSetupComplete: boolean;
  storeSetupComplete: boolean;
  onboardingComplete: boolean;
  onboardingCompleteSeen: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isReceptionist: boolean;
  canAccessManagerDashboard: boolean;
  canAccessReceptionistDashboard: boolean;
  memberships: StoreMembershipDTO[];
  staff: StaffDTO;
  profile: DashboardStaffProfile;
};

export type DashboardAccessDenialReason = AccountAccessDenialReason;
export type DashboardAccessDecision = AccountAccessDecision;

function profileStore(profile: DashboardStaffProfile) {
  return Array.isArray(profile.stores) ? profile.stores[0] ?? null : profile.stores ?? null;
}

function profileAccountStatus(profile: DashboardStaffProfile): DashboardSession["accountStatus"] {
  return profile.account_status ?? (profile.is_active ? "active" : "deactivated");
}

export function decideDashboardAccess(profile: DashboardStaffProfile | null | undefined): DashboardAccessDecision {
  return decideAccountAccess(profile);
}

export function restrictedPathForSession(session: Pick<DashboardSession, "isManager" | "isReceptionist"> | null | undefined) {
  if (session?.isManager) return "/dashboard/restricted/manager" as never;
  if (session?.isReceptionist) return "/dashboard/restricted/receptionist" as never;
  return "/dashboard/restricted" as never;
}

export async function auditAccessDenied(session: DashboardSession, action: string, reason: DashboardAccessDenialReason) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("audit_logs").insert({
    user_id: session.authUserId,
    action,
    table_name: "auth_access",
    record_id: session.staffProfileId,
    store_id: session.assignedStoreId,
    result: "denied",
    details: {
      reason,
      staffProfileId: session.staffProfileId,
      accountStatus: session.accountStatus,
      storeId: session.assignedStoreId,
      storeAccessStatus: session.storeAccessStatus
    }
  });
}

function displayName(profile: DashboardStaffProfile, user: User) {
  const fullName = profile.full_name?.trim();
  const profileName = [profile.first_name, profile.surname].map((value) => value?.trim()).filter(Boolean).join(" ");
  return fullName || profileName || profile.email || user.email || "Staff";
}

function accountSetupComplete(profile: DashboardStaffProfile) {
  if (profile.temporary_password_active === true) return false;
  const legalAccepted = Boolean(profile.terms_accepted_at && profile.privacy_policy_accepted_at && profile.terms_version && profile.privacy_policy_version);
  const baseComplete = profile.account_setup_complete === true || profile.profile_setup_complete === true;
  if (!legalAccepted || !baseComplete) return false;
  if (profile.onboarding_complete_seen_at) return true;
  return Boolean(
    profile.full_name &&
      profile.surname &&
      (profile.phone_number || profile.mobile_number) &&
      profile.physical_address &&
      profile.city &&
      profile.province &&
      profile.postal_code
  );
}

function storeSetupComplete(profile: DashboardStaffProfile) {
  const store = profileStore(profile);
  return profile.store_setup_complete === true && Boolean(profile.store_id && store?.store_information_confirmed_at && store.store_information_confirmed_by);
}

async function readProfileForUser(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, user: User) {
  const { data, error } = await supabase
    .from("staff_profiles")
    .select(DASHBOARD_PROFILE_SELECT)
    .eq("auth_user_id", user.id)
    .maybeSingle<DashboardStaffProfile>();

  if (error) throw new Error(error.message);
  return data;
}

const getDashboardSessionCached = cache(async (): Promise<DashboardSession | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  return buildDashboardSession(supabase, user);
});

async function buildDashboardSession(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, user: User): Promise<DashboardSession | null> {
  const profile = await readProfileForUser(supabase, user);

  if (!profile || profileAccountStatus(profile) === "deleted") {
    await supabase.auth.signOut();
    return null;
  }

  const role = profileRoleToStaffRole(profile.role);
  const normalizedRole = normalizeRole(role);
  const store = profileStore(profile);
  const assignedStoreId = profile.role === "admin" ? null : profile.store_id ?? null;
  const memberships: StoreMembershipDTO[] =
    profile.role === "admin"
      ? [{ storeId: "platform", storeSlug: "platform", storeName: "GreenChoice Platform", storeAccessStatus: "active", role }]
      : assignedStoreId
        ? [
            {
              storeId: assignedStoreId,
              storeSlug: store?.slug ?? STORE.slug,
              storeName: store?.name ?? STORE.name,
              storeAccessStatus: store?.store_access_status ?? "restricted",
              role
            }
          ]
        : [];

  const sessionState = await getSessionState();
  const activeMembership =
    memberships.find((item) => item.storeId === sessionState.activeStoreId) ??
    memberships[0] ?? {
      storeId: "",
      storeSlug: "unassigned",
      storeName: "Store setup required",
      storeAccessStatus: "restricted" as const,
      role
    };

  if (activeMembership.storeId !== sessionState.activeStoreId) {
    try {
      await updateSessionState({ activeStoreId: activeMembership.storeId });
    } catch {
      // Server Components cannot always write cookies; the next Server Action will repair the session state.
    }
  }

  const accountDone = accountSetupComplete(profile);
  const storeDone = profile.role === "manager" ? storeSetupComplete(profile) : Boolean(assignedStoreId || profile.role === "admin");
  const onboardingComplete = profile.role === "manager" ? accountDone && storeDone : true;
  const name = displayName(profile, user);
  const storeAccessStatus = activeMembership.storeAccessStatus ?? "restricted";
  const storeId = activeMembership.storeId;
  const staff: StaffDTO = {
    id: user.id,
    email: profile.email || user.email || "",
    displayName: name,
    role,
    storeId,
    storeAccessStatus,
    memberships
  };

  return {
    user,
    authUserId: user.id,
    staffProfileId: profile.id,
    email: staff.email,
    displayName: name,
    role,
    normalizedRole,
    accountStatus: profileAccountStatus(profile),
    assignedStoreId,
    storeId,
    storeName: activeMembership.storeName ?? STORE.name,
    storeSlug: activeMembership.storeSlug ?? STORE.slug,
    storeAccessStatus,
    accountSetupComplete: accountDone,
    storeSetupComplete: storeDone,
    onboardingComplete,
    onboardingCompleteSeen: Boolean(profile.onboarding_complete_seen_at),
    isAdmin: profile.role === "admin",
    isManager: profile.role === "manager",
    isReceptionist: profile.role === "receptionist",
    canAccessManagerDashboard: profile.role === "manager",
    canAccessReceptionistDashboard: profile.role === "manager" || profile.role === "receptionist",
    memberships,
    staff,
    profile
  };
}

export async function getDashboardSession() {
  return getDashboardSessionCached();
}

export async function getDashboardSessionForVerifiedUser(user: User) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  return buildDashboardSession(supabase, user);
}

export async function requireDashboardSession() {
  const session = await getDashboardSession();
  if (!session) throw new Error("Staff authentication required.");
  return session;
}

export async function requireDashboardRoleSession(roles: AccountRole[]) {
  const session = await getDashboardSession();
  if (!session) redirect("/login");

  const decision = decideDashboardAccess(session.profile);
  if (!decision.allowed) {
    await auditAccessDenied(session, "restricted_dashboard_access_attempt", decision.reason);
    redirect(restrictedPathForSession(session));
  }

  if (!roles.includes(session.normalizedRole)) {
    if (session.normalizedRole === "employee_receptionist" && roles.includes("manager")) redirect("/dashboard/receptionist" as never);
    redirect("/denied" as never);
  }

  return session;
}

export async function requireUnrestrictedDashboardSession(role: "manager" | "receptionist") {
  const roles: AccountRole[] = role === "manager" ? ["manager"] : ["employee_receptionist", "manager"];
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  if (!roles.includes(session.normalizedRole)) redirect("/denied" as never);
  const decision = decideDashboardAccess(session.profile);
  if (!decision.allowed) {
    await auditAccessDenied(session, "restricted_dashboard_access_attempt", decision.reason);
    redirect(restrictedPathForSession(session));
  }
  return session;
}

export async function requireActiveManagerDashboardSession() {
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  if (session.normalizedRole !== "manager") redirect("/denied" as never);
  const decision = decideDashboardAccess(session.profile);
  if (!decision.allowed) {
    await auditAccessDenied(session, "restricted_dashboard_access_attempt", decision.reason);
    redirect(restrictedPathForSession(session));
  }
  if (!session.assignedStoreId) redirect("/manager/setup/store" as never);
  return session;
}

export async function requireCompletedManagerDashboardSession() {
  const session = await requireUnrestrictedDashboardSession("manager");
  if (!session.accountSetupComplete) redirect("/manager/setup/account" as never);
  if (!session.storeSetupComplete) redirect("/manager/setup/store" as never);
  if (!session.onboardingCompleteSeen) redirect("/manager/setup/complete" as never);
  return session;
}
