import { BatteryCharging, Cookie, CupSoda, Gem, PackagePlus, ShoppingBag, Cigarette, Leaf } from "lucide-react";
import { BackLink, DashboardCard, DashboardHeader } from "@/components/GreenChoiceDashboard";

export const dynamic = "force-dynamic";

const productCards = [
  { title: "Add New Product", href: "/dashboard/manager/products/new", text: "Create a new active product record.", icon: PackagePlus },
  { title: "Flower", href: "/dashboard/manager/products/category/flower", text: "Manage flower products and subcategories.", icon: Leaf },
  { title: "Vape Cartridges", href: "/dashboard/manager/products/category/vape-cartridges", text: "Manage cartridges, disposables and batteries.", icon: BatteryCharging },
  { title: "Edibles", href: "/dashboard/manager/products/category/edibles", text: "Manage gummies, chocolates, cookies and more.", icon: Cookie },
  { title: "Concentrates", href: "/dashboard/manager/products/category/concentrates", text: "Manage wax, shatter, resin and rosin.", icon: Gem },
  { title: "Pre-Rolls", href: "/dashboard/manager/products/category/pre-rolls", text: "Manage single, multi-pack and infused pre-rolls.", icon: Cigarette },
  { title: "Beverages", href: "/dashboard/manager/products/category/beverages", text: "Manage beverage inventory.", icon: CupSoda },
  { title: "Accessories", href: "/dashboard/manager/products/category/accessories", text: "Manage accessories and non-consumable products.", icon: ShoppingBag }
];

export default function ManagerProductsPage() {
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <BackLink href="/dashboard/manager" />
      <DashboardHeader title="Products" subtitle="Add, edit and manage all products." profileLabel="Manager profile" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {productCards.map((card) => <DashboardCard key={card.href} {...card} />)}
      </div>
    </main>
  );
}
