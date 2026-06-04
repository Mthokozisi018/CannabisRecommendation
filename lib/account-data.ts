import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  DatabaseBackup,
  FileClock,
  Gauge,
  KeyRound,
  LockKeyhole,
  Package,
  ShieldCheck,
  Store,
  UserCog,
  UsersRound
} from "lucide-react";
import type { AccountContextDTO, AccountRole, Permission } from "@/lib/types";
import { STORE } from "@/lib/data";
import { canAccess } from "@/lib/authorization";

export const tenantId = "tenant-greenchoice-preview";

export const guestContext: AccountContextDTO = {
  jurisdiction: "ZA",
  accountState: "active",
  ageVerificationStatus: "not_started",
  assignments: [{ role: "guest", scope: "self" }]
};

export const customerContext: AccountContextDTO = {
  userId: "customer-preview-001",
  tenantId,
  storeId: STORE.id,
  jurisdiction: "ZA",
  accountState: "active",
  ageVerificationStatus: "pending",
  consentVersionAccepted: "privacy-v2026-06",
  mfaEnabled: false,
  assignments: [{ role: "customer", scope: "self" }]
};

export const accountTypes = [
  { role: "employee_receptionist" as AccountRole, title: "Employee", access: "Frontline Access", body: "Process intake, assist customers and manage daily store operations.", href: "/dashboard/receptionist" },
  { role: "manager" as AccountRole, title: "Manager", access: "Management Access", body: "Oversee staff, manage inventory and view assigned-store reports.", href: "/dashboard/manager" },
  { role: "owner" as AccountRole, title: "Owner", access: "Owner Access", body: "View executive reporting, approvals and top-level business settings.", href: "/dashboard/owner" },
  { role: "tenant_admin" as AccountRole, title: "Admin", access: "System Access", body: "Manage tenant configuration, user access, security settings and integrations.", href: "/dashboard/admin" }
];

export const privacyRequests = [
  { id: "PR-1007", type: "Data download", status: "Ready", submitted: "May 20, 2026" },
  { id: "PR-1008", type: "Marketing preference change", status: "Completed", submitted: "May 18, 2026" },
  { id: "PR-1009", type: "Correction request", status: "Under review", submitted: "May 16, 2026" }
];

export const consentRecords = [
  { version: "privacy-v2026-06", label: "Privacy notice and account terms", status: "Accepted", date: "June 4, 2026" },
  { version: "marketing-v2026-05", label: "Marketing updates", status: "Not opted in", date: "June 4, 2026" },
  { version: "adult-gate-v2026-06", label: "Adult-access acknowledgement", status: "Pending verification", date: "June 4, 2026" }
];

export const auditEvents = [
  { time: "10:30", actor: "Ava Mokoena", action: "policy.change", target: "South Africa customer visibility", result: "success" },
  { time: "10:15", actor: "John Manager", action: "role.assignment.requested", target: "Frontline employee access", result: "success" },
  { time: "09:52", actor: "System", action: "restricted_access.denied", target: "adult_customer catalog detail", result: "denied" },
  { time: "09:30", actor: "Privacy Desk", action: "privacy_request.created", target: "PR-1009", result: "success" }
];

export type NavItem = {
  label: string;
  href: string;
  permission: Permission;
  icon: typeof Gauge;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", permission: "recommendation.start", icon: Gauge },
  { label: "Customers", href: "/account/team", permission: "customer.view.store", icon: UsersRound },
  { label: "Privacy Center", href: "/account/privacy", permission: "privacy.manage_self", icon: ShieldCheck },
  { label: "Account Security", href: "/account/security", permission: "account.security.manage", icon: LockKeyhole },
  { label: "Team Access", href: "/account/team", permission: "team.manage.tenant", icon: UserCog },
  { label: "Role Management", href: "/account/roles", permission: "roles.manage.tenant", icon: KeyRound },
  { label: "Audit Log", href: "/account/audit", permission: "audit.view.tenant", icon: FileClock },
  { label: "Consents", href: "/account/privacy#consents", permission: "consent.view.tenant", icon: ClipboardCheck },
  { label: "Inventory", href: "/admin/products", permission: "inventory.manage.store", icon: Package },
  { label: "Reports", href: "/account/reports", permission: "reports.view.tenant", icon: BarChart3 },
  { label: "Backups", href: "/account/audit#backups", permission: "settings.manage.tenant", icon: DatabaseBackup },
  { label: "Appointments", href: "/account/team#appointments", permission: "appointments.manage.store", icon: CalendarDays },
  { label: "Stores", href: "/account/team#stores", permission: "settings.manage.tenant", icon: Store }
];

export function visibleNavItems(context: AccountContextDTO) {
  return navItems.filter((item) => canAccess(context, item.permission, { tenantId: context.tenantId, storeId: context.storeId }));
}
