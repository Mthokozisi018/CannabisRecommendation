"use client";

import { memo, type KeyboardEvent, type MouseEvent } from "react";
import { Cookie, Info, Package } from "lucide-react";
import { Money } from "@/components/GreenChoiceDashboard";
import type { ReceptionistProduct } from "@/lib/receptionist/products";
import { ProductBadges } from "@/components/receptionist/pos/ProductBadges";
import { getPOSProductImage } from "@/components/receptionist/pos/product-display";
import { canAddProduct, isFlowerCategory, isFlowerOrPreRollCategory, stockLabel } from "@/components/receptionist/pos/pos-helpers";

function edibleThcLabel(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toString()} mg`;
}

function ediblePacketValue(product: ReceptionistProduct) {
  const packet = product.thcPerPacketMg;
  if (packet === null || packet === undefined || !Number.isFinite(packet)) return null;
  const serving = product.thcPerUnitMg;
  const sizeLabel = product.sizeLabel?.trim().toLowerCase() ?? "";
  const looksLikePacket = /\b(packet|pack)\b/.test(sizeLabel) || /\b\d+\s*x\b/.test(sizeLabel) || Number(sizeLabel.match(/\b(\d+)\b/)?.[1] ?? 0) > 1;
  if (looksLikePacket || serving === null || serving === undefined || !Number.isFinite(serving) || packet !== serving) return packet;
  return null;
}

function EdibleThcBadges({ product }: { product: ReceptionistProduct }) {
  if (product.categorySlug !== "edibles" && product.categoryName !== "Edibles") return null;

  const serving = edibleThcLabel(product.thcPerUnitMg);
  const packet = edibleThcLabel(ediblePacketValue(product));
  const badges = [
    serving ? { label: "THC per serving", value: serving, Icon: Cookie, className: "border-orange-200/70 bg-[#c43f0a]" } : null,
    packet ? { label: "THC per packet", value: packet, Icon: Package, className: "border-yellow-100/70 bg-[#9a6418]" } : null
  ].filter(Boolean) as { label: string; value: string; Icon: typeof Cookie; className: string }[];

  if (badges.length === 0) return null;

  return (
    <div className={`mt-3 grid gap-2 ${badges.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {badges.map(({ label, value, Icon, className }) => (
        <div key={label} className={`flex min-h-[64px] min-w-0 items-center gap-2 rounded-xl border px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${className}`}>
          <Icon className="shrink-0 text-white/92" size={22} strokeWidth={2.25} />
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold leading-tight text-white/86">{label}</span>
            <span className="block whitespace-nowrap text-base font-extrabold leading-tight text-white">{value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export const ProductCard = memo(function ProductCard({
  product,
  onAddToCart,
  onOpenDescription,
  addFeedback = false,
  visualStyle = "default"
}: {
  product: ReceptionistProduct;
  onAddToCart: (product: ReceptionistProduct) => void;
  onOpenDescription: (productId: string) => void;
  addFeedback?: boolean;
  visualStyle?: "default" | "solid-shading";
}) {
  const disabled = !canAddProduct(product);
  const compactStrainCard = isFlowerOrPreRollCategory(product);
  const flowerCard = isFlowerCategory(product);
  const edibleCard = product.categorySlug === "edibles" || product.categoryName === "Edibles";
  const regularCard = !compactStrainCard && !edibleCard;
  const productImage = getPOSProductImage(product);
  const solidShading = visualStyle === "solid-shading";
  const cardSurfaceClass = solidShading
    ? "border-2 border-white/58 bg-[linear-gradient(145deg,#101714_0%,#07100c_48%,#030806_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
    : "bg-[linear-gradient(145deg,rgba(12,45,31,0.72),rgba(5,12,10,0.88))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
  const cardBorderClass = solidShading ? "" : "border border-white/12";
  const addButtonGlowClass = solidShading
    ? "border-2 border-emerald-200/55 shadow-[0_0_18px_rgba(16,185,129,0.34),inset_0_1px_0_rgba(255,255,255,0.16)] hover:shadow-[0_0_24px_rgba(16,185,129,0.44),inset_0_1px_0_rgba(255,255,255,0.18)]"
    : "";
  const cardSpacingClass = solidShading
    ? regularCard
      ? "min-h-[224px] p-2"
      : compactStrainCard
        ? "gap-1.5 p-2"
        : "min-h-[286px] p-2"
    : regularCard
      ? "min-h-[260px] p-2"
      : compactStrainCard
        ? "gap-2.5 p-3"
        : "min-h-[320px] p-3";
  const stockPriceRowClass = solidShading
    ? `flex items-center justify-between gap-3 text-sm text-white/80 ${edibleCard ? "mt-1.5" : "mt-0.5"}`
    : `flex items-center justify-between gap-3 text-sm text-white/80 ${compactStrainCard ? "rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5" : edibleCard ? "mt-3" : "mt-2"}`;
  const priceClass = solidShading
    ? "shrink-0 text-right text-xl font-extrabold leading-none text-emerald-400"
    : `shrink-0 text-right font-extrabold text-emerald-400 ${compactStrainCard ? "text-lg" : regularCard ? "text-lg" : "text-xl"}`;
  const openDescription = () => onOpenDescription(product.id);
  const stopNestedClick = (event: MouseEvent<HTMLButtonElement>) => event.stopPropagation();
  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openDescription();
  };
  const handleAddToCart = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onAddToCart(product);
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={openDescription}
      onKeyDown={handleCardKeyDown}
      aria-label={`View ${product.name} information`}
      className={`group flex h-full cursor-pointer touch-manipulation flex-col rounded-xl ${cardBorderClass} ${cardSurfaceClass} ${cardSpacingClass} transition focus-visible:ring-2 focus-visible:ring-emerald-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020503]`}
    >
      <div className={`relative grid place-items-center overflow-hidden rounded-lg bg-black/20 ${regularCard ? "mb-1.5 aspect-[16/9]" : compactStrainCard ? (solidShading ? "aspect-[16/11]" : "aspect-[4/3]") : solidShading ? "mb-1.5 aspect-[16/11]" : "mb-2 aspect-[4/3]"}`}>
        {/* Product images can be Supabase URLs or local placeholders. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={productImage} alt={`${product.name} product image`} className="absolute inset-0 size-full object-contain p-2 drop-shadow-[0_14px_24px_rgba(0,0,0,0.55)] transition group-hover:scale-105" />
        <button onClick={(event) => { stopNestedClick(event); openDescription(); }} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full border border-white/80 bg-black/35 text-white" aria-label={`View ${product.name} information`}>
          <Info size={17} />
        </button>
        <span className="absolute bottom-2 left-2 rounded-md bg-emerald-500/75 px-2 py-1 text-xs font-bold">{product.categoryName}</span>
      </div>
      <div className={compactStrainCard ? "space-y-1" : ""}>
        <div className={edibleCard ? "flex items-start justify-between gap-3" : ""}>
          <div className="min-w-0">
            <p className={`line-clamp-2 font-extrabold ${compactStrainCard ? "text-base leading-snug" : regularCard ? "text-base leading-tight" : "text-lg"}`}>{product.name}</p>
            {compactStrainCard ? null : product.sizeLabel ? <p className={`${edibleCard ? "mt-1 min-h-5" : "mt-2 min-h-6"} text-sm text-white/72`}>{product.sizeLabel}</p> : edibleCard ? null : <div className="mt-2 min-h-6" />}
          </div>
        </div>
      </div>
      <div className={stockPriceRowClass}>
        <span>{stockLabel(product.quantityAvailable)}</span>
        <p className={priceClass}>
          <Money value={product.sellingPrice} /> {flowerCard ? <span className="text-sm font-extrabold text-emerald-200">/gram</span> : product.sizeLabel ? <span className="text-sm font-medium text-white/78">/ {product.sizeLabel}</span> : null}
        </p>
      </div>
      {edibleCard ? (
        <div className="mt-2 flex min-h-9 items-center gap-3">
          <ProductBadges product={product} className="flex min-w-0 flex-wrap items-center gap-2" />
        </div>
      ) : (
        <ProductBadges product={product} />
      )}
      <EdibleThcBadges product={product} />
      <button disabled={disabled} onClick={handleAddToCart} className={`touch-manipulation rounded-xl bg-emerald-500 font-bold text-white transition hover:bg-emerald-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none motion-reduce:transition-none ${addFeedback ? "bg-lime-400 text-[#04100a] shadow-[0_0_24px_rgba(190,242,100,0.42)]" : ""} ${addButtonGlowClass} ${solidShading ? compactStrainCard ? "min-h-11 px-4 py-2 text-sm" : regularCard ? "mt-1.5 min-h-11 px-4 py-2 text-sm" : "mt-2 min-h-12 px-4 py-2.5 text-sm" : compactStrainCard ? "min-h-11 px-4 py-2.5 text-sm" : regularCard ? "mt-2 min-h-11 px-4 py-2 text-sm" : "mt-3 min-h-12 px-4 py-3"}`}>
        {addFeedback ? "Added" : "Add to cart"}
      </button>
    </article>
  );
});
