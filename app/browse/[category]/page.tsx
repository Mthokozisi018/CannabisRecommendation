import Link from "next/link";
import { DraftCart } from "@/components/DraftCart";
import { FilterSidebar } from "@/components/FilterSidebar";
import { ProductCard } from "@/components/ProductCard";
import { listCategories, listRecommendedProducts, getFilterOptions } from "@/lib/dal/catalog";
import { getCurrentStore } from "@/lib/dal/auth";
import { filtersFromSearchParams } from "@/lib/schemas/filters";

export default async function CategoryBrowsePage({ params, searchParams }: { params: Promise<{ category: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ category }, rawParams] = await Promise.all([params, searchParams]);
  const effect = typeof rawParams.effect === "string" ? rawParams.effect : "relaxed";
  const filters = filtersFromSearchParams(new URLSearchParams(rawParams as Record<string, string>), category);
  const [products, categories, options, store] = await Promise.all([
    listRecommendedProducts(effect, filters),
    listCategories(effect, filters),
    getFilterOptions(category),
    getCurrentStore()
  ]);
  const current = categories.find((item: { slug: string }) => item.slug === category);
  return (
    <main className="mx-auto max-w-[1700px] px-4 py-5">
      <div className="mb-5">
        <Link href={`/browse?effect=${effect}`} className="text-sm text-mint">All categories</Link>
        <h1 className="mt-2 text-2xl font-semibold">{current?.name ?? category} matches</h1>
        <p className="text-sm text-white/50">{products.length} ranked products for {effect}</p>
      </div>
      <nav className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {categories.map((item: { slug: string; name: string; count: number }) => (
          <Link key={item.slug} href={`/browse/${item.slug}?effect=${effect}`} className={`rounded-lg border px-4 py-2 text-sm ${item.slug === category ? "border-mint bg-mint text-ink" : "border-white/10 bg-white/[0.04] text-white/80"}`}>
            {item.name} <span className="ml-1">{item.count}</span>
          </Link>
        ))}
      </nav>
      <div className="grid gap-5 lg:grid-cols-[280px_1fr_330px]">
        <FilterSidebar options={options} filters={filters} category={category} effect={effect} />
        <section className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => <ProductCard key={product.id} product={product} effect={effect} />)}
        </section>
        <DraftCart currencyCode={store.currencyCode} />
      </div>
    </main>
  );
}
