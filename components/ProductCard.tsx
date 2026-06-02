import Link from "next/link";
import { Plus } from "lucide-react";
import { addToCartAction } from "@/app/actions";
import { money } from "@/lib/services/format";
import type { ProductMatchDTO } from "@/lib/types";
import { ProductBadges } from "./Badges";
import { ProductImage } from "./ProductImage";

export function ProductCard({ product, effect }: { product: ProductMatchDTO; effect: string }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.045] p-3 shadow-glow">
      <Link href={`/products/${product.slug}?effect=${effect}`} className="block">
        <ProductImage slug={product.slug} name={product.name} />
      </Link>
      <div className="mt-4 space-y-3">
        <ProductBadges product={product} matchPct={product.matchPct} />
        <div>
          <Link href={`/products/${product.slug}?effect=${effect}`} className="text-lg font-semibold hover:text-mint">{product.name}</Link>
          <p className="text-sm text-white/55">{product.brand} · {product.sizeLabel}</p>
        </div>
        <p className="line-clamp-2 text-sm text-white/65">{product.description}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">{money(product.priceCents)}</span>
          <form action={addToCartAction}>
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="quantity" value="1" />
            <button className="inline-flex size-10 items-center justify-center rounded-lg bg-mint text-ink focus:outline focus:outline-2 focus:outline-white" aria-label={`Add ${product.name} to draft cart`}>
              <Plus size={18} />
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
