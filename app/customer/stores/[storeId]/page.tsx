import Link from "next/link";
import { ArrowLeft, Clock3, Info, Leaf, MapPin, Navigation, Phone } from "lucide-react";
import { notFound } from "next/navigation";
import { CustomerProductGrid } from "@/components/customer/CustomerProductGrid";
import { FavouriteButton } from "@/components/customer/FavouriteButton";
import { ShareStoreButton } from "@/components/customer/ShareStoreButton";
import { deriveCustomerCategories, getCustomerStore, listCustomerProducts } from "@/lib/customer/catalog";
import { listCustomerFavouriteIds } from "@/lib/customer/favourites";

export default async function CustomerStorePage({ params, searchParams }: { params: Promise<{ storeId: string }>; searchParams: Promise<{ category?: string }> }) {
  const [{ storeId }, query] = await Promise.all([params, searchParams]);
  const [store, products, favourites] = await Promise.all([getCustomerStore(storeId), listCustomerProducts({ storeId }), listCustomerFavouriteIds()]);
  if (!store) notFound();
  const categories = deriveCustomerCategories(products);
  const selectedCategory = query.category && categories.some((category) => category.slug === query.category) ? query.category : categories[0]?.slug;
  const visibleProducts = selectedCategory ? products.filter((product) => product.categorySlug === selectedCategory) : products;
  const fullAddress = [store.address, store.city, store.province, store.postalCode].filter(Boolean).join(", ");
  const hours = Object.entries(store.openingHours).filter(([, value]) => typeof value === "string" && value);

  return (
    <main>
      <section className="relative min-h-64 overflow-hidden bg-[radial-gradient(circle_at_70%_20%,#13764c,#043622_55%,#012519)] px-4 pb-8 pt-5 text-white sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <Link href="/customer/stores" className="grid size-12 place-items-center rounded-full border-2 border-white/55 bg-black/40" aria-label="Back to stores"><ArrowLeft size={25} /></Link>
            <div className="flex gap-3"><FavouriteButton targetType="store" targetId={store.id} initiallySaved={favourites.storeIds.includes(store.id)} className="border-white/55 bg-black/40 text-white" /><ShareStoreButton storeName={store.name} /></div>
          </div>
          <div className="mt-12 flex items-end gap-5">
            <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-white/60 bg-[#03291b] text-emerald-300">
              {/* Store logos can be Supabase URLs configured per tenant. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {store.logoUrl ? <img src={store.logoUrl} alt={`${store.name} logo`} className="size-full object-cover" /> : <Leaf size={48} />}
            </div>
            <div><h1 className="text-3xl font-black sm:text-4xl">{store.name}</h1>{fullAddress ? <p className="mt-2 flex items-center gap-2 text-white/80"><MapPin size={18} />{fullAddress}</p> : null}</div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {fullAddress ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noreferrer" className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-[#dce5df] bg-white font-black"><Navigation className="text-[#087c39]" />Directions</a> : null}
          {store.phoneNumber ? <a href={`tel:${store.phoneNumber}`} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-[#dce5df] bg-white font-black"><Phone className="text-[#087c39]" />Call</a> : null}
          {hours.length ? <a href="#hours" className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-[#dce5df] bg-white font-black"><Clock3 className="text-[#087c39]" />Hours</a> : null}
          {store.description ? <a href="#about" className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-[#dce5df] bg-white font-black"><Info className="text-[#087c39]" />About</a> : null}
        </section>
        {store.description ? <section id="about" className="mt-6 rounded-2xl border-2 border-[#cfe4d5] bg-[#eff9f2] p-5"><h2 className="font-black">About {store.name}</h2><p className="mt-2 text-[#54635a]">{store.description}</p></section> : null}
        {hours.length ? <section id="hours" className="mt-6 rounded-2xl border-2 border-[#dce5df] bg-white p-5"><h2 className="font-black">Opening hours</h2><dl className="mt-3 grid gap-2">{hours.map(([day, value]) => <div key={day} className="flex justify-between gap-4 border-b border-[#edf1ee] py-2"><dt className="capitalize">{day}</dt><dd className="font-bold">{String(value)}</dd></div>)}</dl></section> : null}

        {categories.length ? <nav className="mt-7 flex gap-2 overflow-x-auto pb-2" aria-label="Product categories">{categories.map((category) => <Link key={category.slug} href={`/customer/stores/${store.id}?category=${category.slug}` as never} className={`whitespace-nowrap rounded-xl border-2 px-5 py-2 font-black ${selectedCategory === category.slug ? "border-[#087c39] bg-[#087c39] text-white" : "border-[#d8e1da] bg-white"}`}>{category.name}</Link>)}</nav> : null}
        <section className="mt-6"><h2 className="mb-4 text-2xl font-black">{categories.find((category) => category.slug === selectedCategory)?.name ?? "Products"}</h2>{visibleProducts.length ? <CustomerProductGrid products={visibleProducts} savedProductIds={favourites.productIds} /> : <div className="rounded-2xl border-2 border-[#dfe6e1] bg-white p-9 text-center text-[#65736a]">No available products in this category.</div>}</section>
      </div>
    </main>
  );
}
