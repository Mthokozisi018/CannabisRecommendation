import { Cannabis, Home, Sun, Warehouse } from "lucide-react";
import { CULTIVATION_TYPES } from "@/lib/manager/options";
import type { ReceptionistProduct } from "@/lib/receptionist/products";
import { displaySubcategory, isFlowerOrPreRollCategory, isStrainSubcategory } from "@/components/receptionist/pos/pos-helpers";

function getSubcategoryBadgeStyle(value: string) {
  if (value === "Sativa") return "border-purple-300/25 bg-[linear-gradient(135deg,#a855f7,#581c87)] shadow-[0_10px_24px_rgba(126,34,206,0.28)]";
  if (value === "Indica") return "border-rose-300/25 bg-[linear-gradient(135deg,#f43f5e,#9f1239)] shadow-[0_10px_24px_rgba(225,29,72,0.26)]";
  if (value === "Hybrid") return "border-violet-300/25 bg-[linear-gradient(135deg,#8b5cf6,#4c1d95)] shadow-[0_10px_24px_rgba(109,40,217,0.28)]";
  return "border-emerald-300/25 bg-[linear-gradient(135deg,#10b981,#047857)] shadow-[0_10px_24px_rgba(5,150,105,0.22)]";
}

function getCultivationBadgeStyle(value: string) {
  if (value === "Indoor") return "border-orange-300/30 bg-[linear-gradient(135deg,#fb923c,#c2410c)] shadow-[0_10px_24px_rgba(234,88,12,0.26)]";
  if (value === "Greenhouse") return "border-sky-300/30 bg-[linear-gradient(135deg,#38bdf8,#1d4ed8)] shadow-[0_10px_24px_rgba(37,99,235,0.26)]";
  return "border-green-300/30 bg-[linear-gradient(135deg,#22c55e,#15803d)] shadow-[0_10px_24px_rgba(22,163,74,0.25)]";
}

function shouldShowSubcategoryBadge(product: ReceptionistProduct) {
  const categoryKey = product.categorySlug;
  if (!product.subcategory) return false;
  if (categoryKey === "flower" || categoryKey === "pre-rolls" || categoryKey === "vape-cartridges" || categoryKey === "disposable-vapes") {
    return isStrainSubcategory(product.subcategory);
  }
  return Boolean(product.subcategory && product.subcategory !== "General");
}

function shouldShowCultivationBadge(product: ReceptionistProduct) {
  return isFlowerOrPreRollCategory(product) && CULTIVATION_TYPES.includes(product.cultivationType as never);
}

function ProductBadge({ label, type, compact = false }: { label: string; type: "subcategory" | "cultivation"; compact?: boolean }) {
  const Icon = type === "cultivation" ? (label === "Indoor" ? Home : label === "Greenhouse" ? Warehouse : Sun) : Cannabis;
  const style = type === "cultivation" ? getCultivationBadgeStyle(label) : getSubcategoryBadgeStyle(label);
  return (
    <span className={`inline-flex min-w-0 items-center rounded-full border font-extrabold text-white ${compact ? "min-h-8 w-full justify-center gap-1.5 px-2.5 py-1.5 text-xs" : "min-h-9 gap-2 px-4 py-2 text-sm"} ${style}`}>
      <Icon className="shrink-0" size={compact ? 14 : 16} strokeWidth={2.4} />
      <span className={compact ? "truncate" : ""}>{label}</span>
    </span>
  );
}

export function ProductBadges({ product, className }: { product: ReceptionistProduct; className?: string }) {
  const showSubcategory = shouldShowSubcategoryBadge(product);
  const showCultivation = shouldShowCultivationBadge(product);
  if (!showSubcategory && !showCultivation) return null;
  const useCompactBadges = isFlowerOrPreRollCategory(product);
  const useBadgeRow = useCompactBadges && showSubcategory && showCultivation;
  const defaultClassName = useBadgeRow ? "grid min-h-8 grid-cols-1 gap-2 min-[360px]:grid-cols-2" : useCompactBadges ? "flex min-h-8 items-center gap-2" : "mt-4 flex min-h-9 flex-wrap items-center gap-2";

  return (
    <div className={className ?? defaultClassName}>
      {showSubcategory ? <ProductBadge label={displaySubcategory(product.subcategory)} type="subcategory" compact={useCompactBadges} /> : null}
      {showCultivation && product.cultivationType ? <ProductBadge label={product.cultivationType} type="cultivation" compact={useCompactBadges} /> : null}
    </div>
  );
}
