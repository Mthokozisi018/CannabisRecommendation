import Link from "next/link";
import { Minus, Plus, Search, ShoppingCart, SlidersHorizontal, Trash2 } from "lucide-react";
import { BackLink, DashboardHeader, GlassPanel, Money } from "@/components/GreenChoiceDashboard";
import { listGreenChoiceCategories, listGreenChoiceProducts } from "@/lib/greenchoice-api";

export const dynamic = "force-dynamic";

function stockLabel(quantity: number) {
  if (quantity <= 0) return "Out of stock";
  if (quantity <= 5) return "Low stock";
  return "In stock";
}

export default async function ReceptionistProductsPage({ searchParams }: { searchParams: Promise<{ category?: string; search?: string }> }) {
  const params = await searchParams;
  const [categories, products] = await Promise.all([
    listGreenChoiceCategories(),
    listGreenChoiceProducts({ category: params.category, search: params.search })
  ]);
  const cartPreview = products.data.slice(0, 2);
  const subtotal = cartPreview.reduce((sum, product) => sum + Number(product.selling_price), 0);

  return (
    <main className="mx-auto max-w-[1800px] px-4 py-8">
      <BackLink href="/dashboard/receptionist" />
      <DashboardHeader title="Product Browsing" subtitle="Browse product categories and current store inventory." profileLabel="Receptionist profile" />
      <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="flex h-12 items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.055] px-4">
          <Search className="text-lime-300" size={19} />
          <input placeholder="Search product, SKU or subcategory" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-white/42" defaultValue={params.search ?? ""} />
        </label>
        <Link href="/dashboard/receptionist/customers/register" className="inline-flex h-12 items-center justify-center rounded-2xl bg-lime-500 px-5 font-bold text-white">Register Customer Record</Link>
      </div>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <Link href="/dashboard/receptionist/products" className="rounded-full border border-white/12 bg-white/[0.055] px-4 py-2 text-sm text-white/70">All</Link>
        {categories.data.map((category) => (
          <Link key={category.slug} href={`/dashboard/receptionist/products?category=${category.slug}`} className={`min-w-fit rounded-full border px-4 py-2 text-sm ${params.category === category.slug ? "border-lime-300 bg-lime-400/15 text-lime-300" : "border-white/12 bg-white/[0.055] text-white/70"}`}>{category.name}</Link>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[290px_1fr_340px]">
        <aside className="rounded-2xl border border-white/12 bg-white/[0.055] p-5 backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-bold">Filters</h2>
            <button className="grid size-9 place-items-center rounded-xl border border-white/10 text-lime-300" aria-label="Collapse filters"><SlidersHorizontal size={18} /></button>
          </div>
          {["Category", "Subcategory", "Price range", "Availability", "In stock only", "On promotion", "New arrivals"].map((filter) => <div key={filter} className="mb-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">{filter}</div>)}
          <button className="mt-2 w-full rounded-xl border border-lime-300/30 px-4 py-3 font-semibold text-lime-300">Clear filters</button>
        </aside>
        <section className="grid content-start gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {products.data.map((product) => {
            const unavailable = product.quantityAvailable <= 0 || !product.is_active || product.is_archived;
            return (
              <GlassPanel key={product.id} className="flex min-h-[360px] flex-col">
                <div className="grid aspect-[4/3] place-items-center rounded-2xl border border-white/10 bg-[radial-gradient(circle,rgba(116,214,81,0.22),transparent_65%)]">
                  <ShoppingCart className="text-lime-300" size={52} />
                </div>
                <div className="mt-4 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2 text-xs">
                    {product.hasActivePromotion ? <span className="rounded-full bg-lime-400/15 px-2 py-1 text-lime-300">Promotion</span> : null}
                    {product.is_new ? <span className="rounded-full bg-white/10 px-2 py-1 text-white/70">New</span> : null}
                    {unavailable ? <span className="rounded-full bg-red-400/15 px-2 py-1 text-red-200">Out of stock</span> : null}
                  </div>
                  <p className="text-xl font-bold">{product.name}</p>
                  <p className="mt-1 text-sm text-white/55">{product.categoryName} · {product.subcategory}</p>
                  <p className="mt-3 text-2xl font-bold text-lime-300"><Money value={product.selling_price} /></p>
                  <p className="mt-1 text-sm text-white/55">{product.unit_size} · {stockLabel(product.quantityAvailable)}</p>
                </div>
                <button disabled={unavailable} className="mt-5 rounded-xl bg-lime-500 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40">Add to cart</button>
              </GlassPanel>
            );
          })}
        </section>
        <aside className="rounded-2xl border border-white/12 bg-white/[0.055] p-5 backdrop-blur-xl">
          <h2 className="text-2xl font-bold">Customer Cart</h2>
          <div className="mt-4 grid gap-3">
            {cartPreview.length ? cartPreview.map((product) => (
              <div key={product.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold">{product.name}</p><p className="text-sm text-white/55"><Money value={product.selling_price} /></p></div>
                  <button aria-label="Remove item" className="text-white/50"><Trash2 size={17} /></button>
                </div>
                <div className="mt-3 flex items-center gap-2"><button className="grid size-8 place-items-center rounded-lg border border-white/10"><Minus size={14} /></button><span>1</span><button className="grid size-8 place-items-center rounded-lg border border-white/10"><Plus size={14} /></button></div>
              </div>
            )) : <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-white/58">Cart is empty. Add products to prepare a sale.</p>}
          </div>
          <div className="mt-5 space-y-2 text-sm text-white/62">
            <p className="flex justify-between"><span>Subtotal</span><span><Money value={subtotal} /></span></p>
            <p className="flex justify-between"><span>Discount</span><span><Money value={0} /></span></p>
            <p className="flex justify-between"><span>Tax</span><span><Money value={0} /></span></p>
            <p className="flex justify-between border-t border-white/10 pt-3 text-lg font-bold text-white"><span>Total</span><span><Money value={subtotal} /></span></p>
          </div>
          <Link href="/dashboard/receptionist/checkout" className="mt-5 flex h-12 items-center justify-center rounded-xl bg-lime-500 font-bold text-white">Proceed to Checkout</Link>
          <button className="mt-3 h-12 w-full rounded-xl border border-white/12 font-semibold text-white/70">Save Cart</button>
        </aside>
      </div>
      <GlassPanel className="mt-5 text-sm text-white/58">Prices and stock are validated by the backend before checkout. The browser cart is not trusted for final totals.</GlassPanel>
    </main>
  );
}
