import Link from "next/link";
import { Grid2X2, List } from "lucide-react";
import { DraftCart } from "@/components/DraftCart";
import { FilterSidebar } from "@/components/FilterSidebar";
import { ProductCard } from "@/components/ProductCard";
import { listCategories, listRecommendedProducts, getFilterOptions } from "@/lib/dal/catalog";
import { getCurrentStore } from "@/lib/dal/auth";
import { filtersFromSearchParams } from "@/lib/schemas/filters";

export default async function BrowsePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const effect = typeof params.effect === "string" ? params.effect : "relaxed";
  const filters = filtersFromSearchParams(new URLSearchParams(params as Record<string, string>));
  const [products, categories, options, store] = await Promise.all([
    listRecommendedProducts(effect, filters),
    listCategories(effect, filters),
    getFilterOptions(),
    getCurrentStore()
  ]);
  return (
    <main className="mx-auto max-w-[1700px] px-4 py-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Top matches for {effect}</h1>
          <p className="text-sm text-white/50">{products.length} ranked products across all categories</p>
        </div>
        <div className="flex rounded-lg border border-white/10 p-1">
          <button className="grid size-9 place-items-center rounded bg-mint text-ink" aria-label="Grid view"><Grid2X2 size={17} /></button>
          <button className="grid size-9 place-items-center rounded text-white/60" aria-label="List view"><List size={17} /></button>
        </div>
      </div>
      <nav className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <Link href={`/browse?effect=${effect}`} className="rounded-lg bg-mint px-4 py-2 text-sm font-semibold text-ink">All <span className="ml-1">{products.length}</span></Link>
        {categories.map((category: { slug: string; name: string; count: number }) => (
          <Link key={category.slug} href={`/browse/${category.slug}?effect=${effect}`} className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80">
            {category.name} <span className="ml-1 text-white/45">{category.count}</span>
          </Link>
        ))}
      </nav>
      <div className="grid gap-5 lg:grid-cols-[280px_1fr_330px]">
        <FilterSidebar options={options} filters={filters} effect={effect} />
        <section className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => <ProductCard key={product.id} product={product} effect={effect} />)}
        </section>
        <DraftCart currencyCode={store.currencyCode} />
      </div>
    </main>
  );
}
