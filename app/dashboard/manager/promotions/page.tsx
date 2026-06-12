import { BackLink, DashboardHeader, GlassPanel, Money } from "@/components/GreenChoiceDashboard";
import { getPromotions } from "@/lib/greenchoice-api";

export const dynamic = "force-dynamic";

export default async function ManagerPromotionsPage() {
  const promotions = (await getPromotions()).data;
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <BackLink href="/dashboard/manager" />
      <DashboardHeader title="Promotions & Discounts" subtitle="Create and manage promotions and discounts." profileLabel="Manager profile" />
      <GlassPanel className="mb-5">
        <button className="rounded-xl bg-lime-500 px-4 py-2 font-bold text-white">Create promotion</button>
      </GlassPanel>
      <div className="grid gap-4">
        {promotions.map((promo) => (
          <GlassPanel key={promo.id} className="grid gap-4 md:grid-cols-4 md:items-center">
            <div><p className="font-bold">{promo.name}</p><p className="text-sm text-white/55">{promo.categoryName || promo.productName || "Storewide"}</p></div>
            <p>{promo.discount_type === "PERCENTAGE" ? `${promo.discount_value}%` : <Money value={promo.discount_value} />}</p>
            <p>{promo.start_date} to {promo.end_date}</p>
            <p className={promo.is_active ? "text-lime-300" : "text-red-300"}>{promo.is_active ? "Active" : "Inactive"}</p>
          </GlassPanel>
        ))}
      </div>
    </main>
  );
}
