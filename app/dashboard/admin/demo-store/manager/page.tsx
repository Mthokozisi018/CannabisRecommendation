import { AdminDemoNavigationLinks } from "@/components/admin/AdminDemoManagerFeaturePage";
import { ManagerDashboardActions } from "@/components/manager/ManagerDashboardActions";
import { ManagerWelcomePanel } from "@/components/manager/ManagerWelcomePanel";
import { getAdminDemoManagerDashboardSummary, requireAdminDemoStoreContext } from "@/lib/admin/demo-store";

export const dynamic = "force-dynamic";

function managerGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

function firstName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || "Manager";
}

export default async function AdminDemoManagerDashboardPage() {
  const [context, summary] = await Promise.all([
    requireAdminDemoStoreContext(),
    getAdminDemoManagerDashboardSummary()
  ]);

  return (
    <main className="relative isolate min-h-screen px-4 py-8 sm:py-10">
      <section className="mx-auto w-full max-w-[1500px]">
        <AdminDemoNavigationLinks />
        <ManagerWelcomePanel
          greeting={managerGreeting()}
          managerName={firstName(context.adminDisplayName || context.adminEmail || "Manager")}
          roleLabel="Store Manager"
          totalSalesToday={summary.totalSalesToday}
          loggedInToday={summary.loggedInToday}
        />
        <ManagerDashboardActions
          hrefOverrides={{
            products: "/dashboard/admin/demo-store/manager/inventory/manage",
            inventory: "/dashboard/admin/demo-store/manager/inventory",
            staff: "/dashboard/admin/demo-store/manager/staff",
            serve: "/dashboard/admin/demo-store/receptionist"
          }}
          titleOverrides={{ products: "Add Stock" }}
        />
      </section>
    </main>
  );
}
