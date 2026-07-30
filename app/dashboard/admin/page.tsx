import { AdminDashboardHome } from "@/components/admin/AdminDashboardUI";
import { getAdminStats, logAdminAudit } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();
  await logAdminAudit("admin_logged_in", { area: "admin_dashboard" });
  return <AdminDashboardHome stats={stats} />;
}
