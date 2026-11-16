import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SessionActivityMonitor } from "@/components/SessionActivityMonitor";
import { getDashboardSession } from "@/lib/dashboard-session";
import { logoutOwnAccountAction } from "@/app/dashboard/account-actions";

const managerViewPaths = new Set([
  "/dashboard/manager", "/dashboard/manager/inventory", "/dashboard/manager/inventory/view",
  "/dashboard/manager/low-stock", "/dashboard/manager/sales", "/dashboard/manager/products",
  "/dashboard/manager/categories", "/dashboard/manager/suppliers", "/dashboard/manager/staff",
  "/dashboard/receptionist", "/dashboard/receptionist/products"
]);

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getDashboardSession();
  if (session?.demoMode) {
    const pathname = (await headers()).get("x-greenchoice-pathname") ?? "";
    if (session.demoMode === "manager" && pathname && !managerViewPaths.has(pathname)) redirect("/dashboard/manager");
    if (session.demoMode === "franchise_admin" && pathname &&
        (!pathname.startsWith("/dashboard/franchise") || pathname.endsWith("/new"))) redirect("/dashboard/franchise");
  }
  return (
    <>
      <SessionActivityMonitor />
      {session?.demoMode ? <div className="gc-demo-view-only">
        <aside aria-label="Demo account status" className="fixed bottom-3 right-3 z-[100] flex items-center gap-3 rounded-lg border border-emerald-500 bg-[#032017] px-3 py-2 text-xs font-bold text-emerald-100 shadow-xl">
          <span>DEMO ACCOUNT — VIEW ONLY</span>
          <form data-demo-session action={logoutOwnAccountAction}><button className="rounded border border-emerald-600 px-2 py-1">Log Out</button></form>
        </aside>
        {children}
      </div> : children}
    </>
  );
}
