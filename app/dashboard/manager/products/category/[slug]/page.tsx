import { BackLink, DashboardHeader, GlassPanel, VisualHeroPanel } from "@/components/GreenChoiceDashboard";
import { dashboardVisuals } from "@/lib/dashboard-visuals";

export const dynamic = "force-dynamic";

export default async function ManagerProductCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <BackLink href="/dashboard/manager/products" />
      <DashboardHeader title="Category Products" subtitle="View products, prices, SKU and stock thresholds. Archive/deactivate instead of hard delete when sales history exists." profileLabel="Manager profile" />
      <VisualHeroPanel imageSrc={dashboardVisuals.manager.products} alt="GreenChoice product category management visual" className="mb-6 min-h-[200px]">
        <p className="max-w-2xl text-3xl font-extrabold text-white">Add / Edit / Delete</p>
        <p className="mt-3 max-w-2xl text-lg leading-7 text-white/72">Manage products in this category while keeping sales history intact.</p>
      </VisualHeroPanel>
      <GlassPanel>
        <p className="text-white/65">Product catalog is being migrated to Supabase.</p>
        <p className="mt-2 text-sm text-white/40">Product list for category &quot;<strong>{slug}</strong>&quot; coming in the next update.</p>
      </GlassPanel>
    </main>
  );
}
