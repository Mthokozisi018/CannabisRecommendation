import { BackLink, DashboardHeader, GlassPanel } from "@/components/GreenChoiceDashboard";

export default function AddProductPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <BackLink href="/dashboard/manager/products" />
      <DashboardHeader title="Add New Product" subtitle="Product creation form placeholder with backend validation planned for the next CRUD pass." profileLabel="Manager profile" />
      <GlassPanel>
        <p className="text-white/70">Required fields: name, unique SKU, category, selling price, stock quantity and low stock threshold. Archived or inactive products cannot be sold.</p>
      </GlassPanel>
    </main>
  );
}
