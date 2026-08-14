import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductBadges } from "@/components/Badges";
import { DraftCart } from "@/components/DraftCart";
import { ProductImage } from "@/components/ProductImage";
import { getProductBySlug } from "@/lib/dal/catalog";
import { getCurrentStore } from "@/lib/dal/auth";
import { money, percent } from "@/lib/services/format";

export default async function ProductDetailPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, rawParams] = await Promise.all([params, searchParams]);
  const effect = typeof rawParams.effect === "string" ? rawParams.effect : "relaxed";
  const [product, store] = await Promise.all([getProductBySlug(slug, effect), getCurrentStore()]);
  if (!product) notFound();

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6">
      <Link href={`/browse/${product.categorySlug}?effect=${effect}`} className="text-sm text-mint">Back to {product.categoryName}</Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_430px_330px]">
        <section className="space-y-3">
          <ProductImage slug={product.slug} name={product.name} large />
          <div className="grid grid-cols-3 gap-3">
            {product.images.map((image) => <ProductImage key={image.storagePath} slug={product.slug} name={image.altText} />)}
          </div>
        </section>
        <section className="space-y-6 rounded-lg border border-white/10 bg-white/[0.045] p-5">
          <ProductBadges product={product} matchPct={product.matchPct} />
          <div>
            <p className="text-sm text-white/50">{product.brand}</p>
            <h1 className="text-4xl font-semibold">{product.name}</h1>
            <p className="mt-3 text-white/65">{product.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="THC" value={percent(product.thcValue, product.thcUnit)} />
            <Metric label="CBD" value={percent(product.cbdValue, product.cbdUnit)} />
            <Metric label="Terpenes" value={product.terpeneTotalPct ? `${product.terpeneTotalPct}%` : "N/A"} />
            <Metric label="Rating" value={`${product.ratingAvg ?? "N/A"} (${product.ratingCount ?? 0})`} />
          </div>
          <div>
            <h2 className="font-semibold">Effects breakdown</h2>
            <div className="mt-3 space-y-2">
              {product.effects.map((item) => (
                <div key={item.slug}>
                  <div className="flex justify-between text-sm"><span>{item.name}</span><span>{item.scorePct}%</span></div>
                  <div className="mt-1 h-2 rounded bg-white/10"><div className="h-2 rounded bg-mint" style={{ width: `${item.scorePct}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
          <Info title="Best time to use" value={product.bestTimeOfUse ?? "Staff-guided preference dependent."} />
          <Info title="Lineage" value={product.geneticsSummary ?? (product.lineage.map((item) => item.name).join(" x ") || "Not provided")} />
          <div>
            <h2 className="font-semibold">Terpene profile</h2>
            <div className="mt-3 grid gap-2">
              {product.terpenes.length ? product.terpenes.map((item) => <div key={item.slug} className="rounded-lg bg-white/[0.05] p-3 text-sm">{item.name} {item.pct ? `· ${item.pct}%` : ""}</div>) : <p className="text-sm text-white/50">No terpene profile supplied.</p>}
            </div>
          </div>
          <Info title="Flavors" value={product.flavors.map((item) => item.name).join(", ") || "Not provided"} />
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-ink p-4">
            <div>
              <p className="text-2xl font-semibold">{money(product.priceCents, store.currencyCode)}</p>
              <p className="text-sm text-white/50">{product.stockOnHand} units · {product.stockStatus.replaceAll("_", " ")}</p>
            </div>
            <AddToCartButton product={product} />
          </div>
        </section>
        <DraftCart currencyCode={store.currencyCode} />
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-ink p-3"><p className="text-xs text-white/45">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}

function Info({ title, value }: { title: string; value: string }) {
  return <div><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-white/60">{value}</p></div>;
}
