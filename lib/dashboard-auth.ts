import "server-only";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/dal/auth";
import { normalizeRole } from "@/lib/authorization";
import type { AccountRole } from "@/lib/types";

export async function requireDashboardRole(roles: AccountRole[]) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const role = normalizeRole(staff.role);
  if (!roles.includes(role)) redirect("/denied");

  return { ...staff, role };
}
