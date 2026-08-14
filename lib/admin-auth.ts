import "server-only";
import { requireDashboardRoleSession } from "@/lib/dashboard-session";

export function normalizeAuthEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

export async function requireAdmin() {
  const session = await requireDashboardRoleSession(["platform_super_admin"]);
  if (!session.isAdmin || session.profile.role !== "admin" || session.accountStatus !== "active") {
    throw new Error("Administrator access denied.");
  }
  return session;
}
