import { Boxes, ChartNoAxesColumn, CircleAlert, FolderTree, PackagePlus, Percent, ShoppingCart, UsersRound } from "lucide-react";
import { DashboardCard, DashboardHeader, GlassPanel, Money } from "@/components/GreenChoiceDashboard";
import { getManagerSummary } from "@/lib/greenchoice-api";

export const dynamic = "force-dynamic";

const cards = [
  { title: "Products", text: "Add, edit and manage all products.", href: "/dashboard/manager/products", icon: PackagePlus },
  { title: "Inventory", text: "Track stock levels and manage inventory.", href: "/dashboard/manager/inventory", icon: Boxes },
  { title: "Sales & Transactions", text: "View sales, transactions and order history.", href: "/dashboard/manager/sales", icon: ShoppingCart },
  { title: "Staff / Receptionists", text: "Add, edit and manage staff accounts.", href: "/dashboard/manager/staff", icon: UsersRound },
  { title: "Low Stock Alerts", text: "View low stock, out of stock and expiring items.", href: "/dashboard/manager/low-stock", icon: CircleAlert },
  { title: "Promotions & Discounts", text: "Create and manage promotions and discounts.", href: "/dashboard/manager/promotions", icon: Percent },
  { title: "Categories", text: "Manage product categories.", href: "/dashboard/manager/categories", icon: FolderTree }
];

export default async function ManagerDashboardPage() {
  const summary = (await getManagerSummary()).data;

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <DashboardHeader title="Welcome, Manager" subtitle="Manage your dispensary with ease." profileLabel="Manager profile" />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <GlassPanel><ChartNoAxesColumn className="text-lime-300" /><p className="mt-3 text-sm text-white/55">Total stock units</p><p className="text-2xl font-bold">{summary.totalStockUnits}</p></GlassPanel>
        <GlassPanel><Boxes className="text-lime-300" /><p className="mt-3 text-sm text-white/55">Estimated stock value</p><p className="text-2xl font-bold"><Money value={summary.totalEstimatedStockValue} /></p></GlassPanel>
        <GlassPanel><CircleAlert className="text-lime-300" /><p className="mt-3 text-sm text-white/55">Low stock</p><p className="text-2xl font-bold">{summary.lowStockCount}</p></GlassPanel>
        <GlassPanel><UsersRound className="text-lime-300" /><p className="mt-3 text-sm text-white/55">Staff accounts</p><p className="text-2xl font-bold">{summary.staffCount ?? 0}</p></GlassPanel>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <DashboardCard key={card.href} {...card} />)}
      </div>
    </main>
  );
}
