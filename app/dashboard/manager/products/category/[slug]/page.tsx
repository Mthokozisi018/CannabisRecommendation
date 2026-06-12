import { BackLink, DashboardHeader, GlassPanel, Money } from "@/components/GreenChoiceDashboard";
import { listGreenChoiceProducts } from "@/lib/greenchoice-api";

export const dynamic = "force-dynamic";

export default async function ManagerProductCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const products = (await listGreenChoiceProducts({ category: slug })).data;
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <BackLink href="/dashboard/manager/products" />
      <DashboardHeader title="Category Products" subtitle="View products, prices, SKU and stock thresholds. Archive/deactivate instead of hard delete when sales history exists." profileLabel="Manager profile" />
      <div className="grid gap-4">
        {products.map((product) => (
          <GlassPanel key={product.id} className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:items-center">
            <div>
              <p className="text-xl font-bold">{product.name}</p>
              <p className="mt-1 text-sm text-white/55">{product.sku} · {product.subcategory || product.categoryName}</p>
            </div>
            <p><span className="text-white/50">Price </span><Money value={product.selling_price} /></p>
            <p><span className="text-white/50">Stock </span>{product.quantityAvailable}</p>
            <p><span className="text-white/50">Threshold </span>{product.lowStockThreshold}</p>
          </GlassPanel>
        ))}
      </div>
    </main>
  );
}
