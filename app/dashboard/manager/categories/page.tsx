import { BackLink, DashboardHeader, GlassPanel } from "@/components/GreenChoiceDashboard";
import { listGreenChoiceCategories } from "@/lib/greenchoice-api";

export const dynamic = "force-dynamic";

export default async function ManagerCategoriesPage() {
  const categories = (await listGreenChoiceCategories()).data;
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <BackLink href="/dashboard/manager" />
      <DashboardHeader title="Categories" subtitle="View categories, manage names, icons and active status." profileLabel="Manager profile" />
      <GlassPanel className="mb-5">
        <button className="rounded-xl bg-lime-500 px-4 py-2 font-bold text-white">Add category</button>
      </GlassPanel>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <GlassPanel key={category.slug}>
            <p className="text-xl font-bold">{category.name}</p>
            <p className="mt-2 text-sm text-white/55">{category.description}</p>
            <p className="mt-5 text-sm text-lime-300">{category.is_active ? "Active" : "Inactive"}</p>
          </GlassPanel>
        ))}
      </div>
    </main>
  );
}
