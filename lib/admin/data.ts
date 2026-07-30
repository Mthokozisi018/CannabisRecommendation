import "server-only";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { requireUnrestrictedDashboardSession } from "@/lib/dashboard-session";

export type AdminStoreMember = {
  name: string;
  email: string;
  role: "manager" | "receptionist";
  status: string;
};

export type AdminStore = {
  id: string;
  name: string;
  address: string;
  accessStatus: "active" | "restricted";
  managers: AdminStoreMember[];
  receptionists: AdminStoreMember[];
};

export type AdminStoreAccessRow = Pick<AdminStore, "id" | "name" | "address" | "accessStatus">;

export type PendingManagerInvitation = {
  id: string;
  email: string;
  invitedAt: string;
  lastSentAt: string | null;
};

export type AdminStats = {
  totalStores: number;
  totalManagers: number;
  totalReceptionists: number;
  pendingInvitations: number;
  activeSubscriptions: number;
};

type StoreRow = {
  id: string;
  name: string;
  address?: string | null;
  store_address?: string | null;
  store_access_status?: "active" | "restricted" | null;
};

type StaffRow = {
  id: string;
  store_id?: string | null;
  email: string;
  full_name?: string | null;
  first_name?: string | null;
  surname?: string | null;
  role: "admin" | "manager" | "receptionist";
  account_status?: string | null;
  is_active?: boolean | null;
};

function requireAdminClient() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin client is not configured.");
  return admin;
}

export async function requireAdminUser() {
  const session = await requireAdmin();
  return { ...session.staff, role: session.normalizedRole };
}

export async function logAdminAudit(action: string, details: Record<string, unknown>, recordId?: string | null) {
  const staff = await requireAdminUser();
  const admin = requireAdminClient();
  const storeId = typeof details.storeId === "string" ? details.storeId : null;
  const result = typeof details.result === "string" ? details.result : "success";
  await admin.from("audit_logs").insert({
    user_id: staff.id,
    action,
    table_name: "admin_dashboard",
    record_id: recordId ?? null,
    store_id: storeId,
    result,
    details
  });
}

export async function getAdminStats(): Promise<AdminStats> {
  await requireAdminUser();
  const admin = requireAdminClient();

  const [stores, managers, receptionists, invitations, activeStores] = await Promise.all([
    admin.from("stores").select("id", { count: "exact", head: true }),
    admin.from("staff_profiles").select("id", { count: "exact", head: true }).eq("role", "manager").or("account_status.eq.active,and(account_status.is.null,is_active.eq.true)"),
    admin.from("staff_profiles").select("id", { count: "exact", head: true }).eq("role", "receptionist").or("account_status.eq.active,and(account_status.is.null,is_active.eq.true)"),
    admin.from("manager_invitations").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("stores").select("id", { count: "exact", head: true }).eq("store_access_status", "active")
  ]);

  const firstError = [stores.error, managers.error, receptionists.error, invitations.error, activeStores.error].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  return {
    totalStores: stores.count ?? 0,
    totalManagers: managers.count ?? 0,
    totalReceptionists: receptionists.count ?? 0,
    pendingInvitations: invitations.count ?? 0,
    activeSubscriptions: activeStores.count ?? 0
  };
}

export async function getAdminStores(): Promise<AdminStore[]> {
  await requireAdminUser();
  const admin = requireAdminClient();
  const [storesResult, staffResult] = await Promise.all([
    admin.from("stores").select("id, name, address, store_address, store_access_status").order("name"),
    admin.from("staff_profiles").select("id, store_id, email, full_name, first_name, surname, role, account_status, is_active").in("role", ["manager", "receptionist"]).is("deleted_at", null)
  ]);

  if (storesResult.error) throw new Error(storesResult.error.message);
  if (staffResult.error) throw new Error(staffResult.error.message);

  const staffRows = (staffResult.data ?? []) as StaffRow[];
  return ((storesResult.data ?? []) as StoreRow[]).map((store) => {
    const members = staffRows.filter((member) => member.store_id === store.id);
    const toMember = (member: StaffRow): AdminStoreMember => ({
      name: member.full_name || [member.first_name, member.surname].filter(Boolean).join(" ") || member.email,
      email: member.email,
      role: member.role === "manager" ? "manager" : "receptionist",
      status: member.account_status ?? (member.is_active ? "active" : "deactivated")
    });

    return {
      id: store.id,
      name: store.name,
      address: store.address ?? store.store_address ?? "Address not set",
      accessStatus: store.store_access_status ?? "active",
      managers: members.filter((member) => member.role === "manager").map(toMember),
      receptionists: members.filter((member) => member.role === "receptionist").map(toMember)
    };
  });
}

export async function getPendingManagerInvitations(): Promise<PendingManagerInvitation[]> {
  await requireAdminUser();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("manager_invitations")
    .select("id, email, invited_at, last_sent_at")
    .eq("status", "pending")
    .order("invited_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((item) => ({
    id: item.id,
    email: item.email,
    invitedAt: item.invited_at,
    lastSentAt: item.last_sent_at
  }));
}

export async function getStoreAccessRows(): Promise<AdminStoreAccessRow[]> {
  await requireAdminUser();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("stores")
    .select("id, name, address, store_address, store_access_status")
    .order("name");

  if (error) throw new Error(error.message);

  return ((data ?? []) as StoreRow[]).map((store) => ({
    id: store.id,
    name: store.name,
    address: store.address ?? store.store_address ?? "Address not set",
    accessStatus: store.store_access_status ?? "active"
  }));
}

export async function requireUnrestrictedStaffRoute(role: "manager" | "receptionist") {
  const session = await requireUnrestrictedDashboardSession(role);
  return { ...session.staff, role: session.normalizedRole };
}

export async function getLoggedInSupabaseUserId() {
  const supabase = await createSupabaseServerClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  return data.user?.id ?? null;
}
