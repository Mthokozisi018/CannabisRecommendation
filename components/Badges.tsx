import type { ProductDTO } from "@/lib/types";

export function ProductBadges({ product, matchPct }: { product: ProductDTO; matchPct?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {matchPct !== undefined ? <span className="rounded bg-mint px-2 py-1 text-xs font-semibold text-ink">{matchPct}% match</span> : null}
      <span className="rounded bg-white/10 px-2 py-1 text-xs text-white/80">{product.categoryName}</span>
      {product.strainType ? <span className="rounded bg-white/10 px-2 py-1 text-xs text-white/80">{product.strainType}</span> : null}
      {product.stockStatus !== "out_of_stock" ? <span className="rounded bg-moss/70 px-2 py-1 text-xs">In stock</span> : <span className="rounded bg-red-500/30 px-2 py-1 text-xs">Out</span>}
      {product.isNew ? <span className="rounded bg-sky-400/20 px-2 py-1 text-xs text-sky-100">New</span> : null}
      {product.isOnSpecial ? <span className="rounded bg-amber/20 px-2 py-1 text-xs text-amber">Sale</span> : null}
      {product.isLabTested ? <span className="rounded bg-white/10 px-2 py-1 text-xs text-white/80">Lab-tested</span> : null}
    </div>
  );
}
