import "server-only";
import { requireDashboardRoleSession } from "@/lib/dashboard-session";
import type { AccountRole } from "@/lib/types";

export async function requireDashboardRole(roles: AccountRole[]) {
  const session = await requireDashboardRoleSession(roles);
  return { ...session.staff, role: session.normalizedRole };
}
