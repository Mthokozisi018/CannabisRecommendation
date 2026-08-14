import Link from "next/link";
import { Bell, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { CustomerProductGrid } from "@/components/customer/CustomerProductGrid";
import { CustomerStoreCard } from "@/components/customer/CustomerStoreCard";
import { requireCustomerSession } from "@/lib/customer/auth";
import { listCustomerProducts, listCustomerStores } from "@/lib/customer/catalog";
import { listCustomerFavouriteIds } from "@/lib/customer/favourites";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Customer Home | GreenChoice" };

export default async function CustomerHomePage() {
  const session = await requireCustomerSession();
  const [stores, products, favourites, supabase] = await Promise.all([listCustomerStores(), listCustomerProducts({ limit: 12 }), listCustomerFavouriteIds(), createSupabaseServerClient()]);
  const { data: address } = await supabase?.from("customer_addresses").select("city,province").eq("user_id", session.user.id).eq("is_default", true).maybeSingle() ?? { data: null };
  const recentProducts = products.filter((product) => product.isNew).slice(0, 6);

  return (
    <main>
      <section className="bg-[radial-gradient(circle_at_20%_0%,#0b6840,#023421_56%,#012719)] px-4 pb-8 pt-7 text-white sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-start justify-between gap-4"><div><h1 className="text-3xl font-black sm:text-4xl">Hi, {session.profile.first_name} <span aria-hidden="true">👋</span></h1><p className="mt-2 text-lg text-white/78">Browse real products from GreenChoice stores.</p></div><Link href="/customer/profile/notifications" className="grid size-12 place-items-center rounded-full border-2 border-white/30 bg-white/10" aria-label="Notifications"><Bell size={24} /></Link></div>
          <form action="/customer/stores" className="mt-7 flex h-14 items-center gap-3 rounded-2xl bg-white px-4 text-[#1a2a21] shadow-xl"><Search size={24} className="text-[#7a867e]" /><input name="search" className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Search stores or products..." aria-label="Search stores or products" /><button aria-label="Open filters" className="grid size-10 place-items-center rounded-full"><SlidersHorizontal size={23} /></button></form>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {address ? <Link href="/customer/profile/addresses" className="flex items-center justify-between rounded-2xl border-2 border-[#dfe6e1] bg-white p-4 shadow-sm"><span className="flex items-center gap-3"><MapPin className="text-[#0b8a40]" /><span><strong className="block">{[address.city, address.province].filter(Boolean).join(", ")}</strong><span className="text-sm text-[#67736b]">Your default location</span></span></span><span className="font-bold text-[#0b8a40]">Change</span></Link> : null}

        <section className="mt-8"><div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-black">Available Stores</h2><Link href="/customer/stores" className="font-black text-[#0b8a40]">View all</Link></div>{stores.length ? <div className="grid gap-4">{stores.slice(0, 3).map((store) => <CustomerStoreCard key={store.id} store={store} saved={favourites.storeIds.includes(store.id)} />)}</div> : <div className="rounded-2xl border-2 border-[#dfe6e1] bg-white p-8 text-center text-[#65736a]">No active stores are available yet.</div>}</section>

        <section className="mt-9"><div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-black">Available Products</h2><Link href="/customer/stores" className="font-black text-[#0b8a40]">Browse stores</Link></div>{products.length ? <CustomerProductGrid products={products.slice(0, 6)} savedProductIds={favourites.productIds} /> : <div className="rounded-2xl border-2 border-[#dfe6e1] bg-white p-8 text-center text-[#65736a]">Products published by GreenChoice stores will appear here.</div>}</section>

        {recentProducts.length ? <section className="mt-9"><h2 className="mb-4 text-2xl font-black">Recently Added</h2><CustomerProductGrid products={recentProducts} savedProductIds={favourites.productIds} /></section> : null}
      </div>
    </main>
  );
}

