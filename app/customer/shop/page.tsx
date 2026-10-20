import { Store } from "lucide-react";
import Image from "next/image";
import { CustomerEmptyState } from "@/components/customer/CustomerEmptyState";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { CustomerStoreCard } from "@/components/customer/CustomerStoreCard";
import { requireCustomerSession } from "@/lib/customer/auth";
import { listCustomerStores } from "@/lib/customer/catalog";
import { listCustomerFavouriteIds } from "@/lib/customer/favourites";

export const metadata = { title: "Shop | GreenChoice" };

export default async function CustomerShopPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const query = await searchParams;
  const search = (typeof query.q === "string" ? query.q : "").trim().slice(0, 100);
  const [, stores, favourites] = await Promise.all([
    requireCustomerSession(),
    listCustomerStores({ search }),
    listCustomerFavouriteIds(),
  ]);

  return (
    <main className="min-h-screen">
      <CustomerHeader notifications />
      <section className="mx-auto max-w-6xl px-4 pb-4 pt-7 sm:px-6 sm:pt-8">
        <div className="gc-pos-logo-wrap flex justify-center">
          <Image
            src="/branding/greenchoice-logo.png"
            alt="GreenChoice Dispensary"
            width={1028}
            height={307}
            priority
            className="gc-pos-logo h-20 w-[min(30cm,calc(100vw-2rem))] object-contain sm:h-24 sm:w-[min(30cm,58vw)] lg:h-28"
          />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-2 sm:px-6">
        <h1 className="text-3xl font-black">Shop</h1>
        <p className="mb-5 mt-2 text-[#aab4ac]">Choose a GreenChoice store to browse its products and categories.</p>
        <form action="/customer/shop" className="mb-6 flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-sm font-bold">Search stores<input name="q" defaultValue={search} maxLength={100} className="mt-2 h-12 w-full rounded-md border border-[#405347] bg-[#08100b] px-3 text-white outline-none focus:border-[#a8e91d]" /></label>
          <button className="min-h-12 rounded-md border border-[#86b724] bg-[#14230b] px-5 font-bold text-[#a8e91d]">Search</button>
        </form>
        {stores.length ? (
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {stores.map((store) => (
              <CustomerStoreCard
                key={store.id}
                store={store}
                saved={favourites.storeIds.includes(store.id)}
                landingRow
              />
            ))}
          </div>
        ) : (
          <CustomerEmptyState
            Icon={Store}
            title={search ? "No matching stores" : "No active stores yet"}
            message={search ? "Try another store name or clear your search." : "Active GreenChoice locations will appear here."}
            href={search ? "/customer/shop" : undefined}
            action={search ? "Clear search" : undefined}
          />
        )}
      </section>
    </main>
  );
}
