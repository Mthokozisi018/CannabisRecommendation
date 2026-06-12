import { BatteryCharging, Cookie, CupSoda, Gem, Leaf, PackageSearch } from "lucide-react";
import { DashboardCard, DashboardHeader, GlassPanel } from "@/components/GreenChoiceDashboard";

export const dynamic = "force-dynamic";

const categories = [
  { title: "Flower", text: "Browse flower inventory and current availability.", href: "/dashboard/receptionist/products?category=flower", icon: Leaf },
  { title: "Edibles", text: "Browse edible product categories and stock.", href: "/dashboard/receptionist/products?category=edibles", icon: Cookie },
  { title: "Vape Cartridges", text: "Browse cartridges, disposables and batteries.", href: "/dashboard/receptionist/products?category=vape-cartridges", icon: BatteryCharging },
  { title: "Concentrates", text: "Browse concentrate inventory.", href: "/dashboard/receptionist/products?category=concentrates", icon: Gem },
  { title: "Beverages", text: "Browse beverage inventory.", href: "/dashboard/receptionist/products?category=beverages", icon: CupSoda },
  { title: "Other Products", text: "Browse pre-rolls, oils, topicals, accessories and bundles.", href: "/dashboard/receptionist/products", icon: PackageSearch }
];

export default function ReceptionistDashboardPage() {
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <DashboardHeader title="What would you like to browse today?" subtitle="Browse available product categories and current store inventory." profileLabel="Receptionist profile" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => <DashboardCard key={category.href} {...category} />)}
      </div>
      <GlassPanel className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-white/65">Need help with a workflow?</p>
        <button className="w-fit rounded-xl border border-lime-300/35 bg-lime-400/10 px-4 py-2 font-semibold text-lime-300">Ask for Assistance</button>
      </GlassPanel>
    </main>
  );
}
