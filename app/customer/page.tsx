import Link from "next/link";
import { Store } from "lucide-react";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { CustomerStoreCard } from "@/components/customer/CustomerStoreCard";
import { requireCustomerSession } from "@/lib/customer/auth";
import { listCustomerStores, listRecentlyViewedStores } from "@/lib/customer/catalog";
import { listCustomerFavouriteIds } from "@/lib/customer/favourites";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Customer Home | GreenChoice" };

export default async function CustomerHomePage() {
  const [session, supabase] = await Promise.all([requireCustomerSession(), createSupabaseServerClient()]);
  const { data: address } = await supabase!.from("customer_addresses")
    .select("city,province,latitude,longitude").eq("user_id", session.user.id).eq("is_default", true).maybeSingle();
  const [stores, recentStores, favourites] = await Promise.all([
    listCustomerStores({ latitude: address?.latitude ?? null, longitude: address?.longitude ?? null }),
    listRecentlyViewedStores(4),
    listCustomerFavouriteIds()
  ]);
  return (
    <main className="min-h-screen">
      <CustomerHeader notifications />

      <div className="mx-auto max-w-6xl px-4 pb-8 pt-4 sm:px-6">
        {recentStores.length ? (
          <section>
            <div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-2xl font-black">Recently viewed</h2><p className="mt-1 text-sm text-[#9da8a0]">Continue browsing stores you opened.</p></div></div>
            <div className="flex gap-4 overflow-x-auto pb-3">{recentStores.map((store) => <CustomerStoreCard key={store.id} store={store} compact saved={favourites.storeIds.includes(store.id)} />)}</div>
          </section>
        ) : null}

        <section className={recentStores.length ? "mt-10" : ""}>
          <div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-2xl font-black">Nearby stores</h2><p className="mt-1 text-sm text-[#9da8a0]">Distance appears only when both your saved address and a store have coordinates.</p></div><Link href="/customer/stores" className="shrink-0 text-sm font-bold text-[#a8e91d]">View all</Link></div>
          {stores.length ? <div className="grid gap-4 lg:grid-cols-2">{stores.slice(0, 4).map((store) => <CustomerStoreCard key={store.id} store={store} saved={favourites.storeIds.includes(store.id)} />)}</div> : <div className="border border-[#263229] bg-[#07100b] p-10 text-center"><Store className="mx-auto text-[#a8e91d]" size={42} /><h2 className="mt-4 text-xl font-black">No active stores yet</h2><p className="mt-2 text-sm text-[#aab4ac]">Active GreenChoice locations will appear here.</p></div>}
        </section>
      </div>
    </main>
  );
}
