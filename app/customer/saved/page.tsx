import { Heart } from "lucide-react";
import { CustomerEmptyState } from "@/components/customer/CustomerEmptyState";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { CustomerStoreCard } from "@/components/customer/CustomerStoreCard";
import { listCustomerStores } from "@/lib/customer/catalog";
import { listCustomerFavouriteIds } from "@/lib/customer/favourites";

export const metadata = { title: "Saved Stores | GreenChoice" };

export default async function CustomerSavedPage() {
  const [stores, favourites] = await Promise.all([listCustomerStores(), listCustomerFavouriteIds()]);
  const savedStores = stores.filter((store) => favourites.storeIds.includes(store.id));
  return (
    <main className="min-h-screen">
      <CustomerHeader />
      <section className="border-y border-[#253029] bg-[#08110b]"><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><h1 className="text-3xl font-black sm:text-4xl">Saved Stores</h1><p className="mt-2 text-[#a7b1a9]">Your saved GreenChoice locations in one place.</p></div></section>
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {savedStores.length ? <div className="grid gap-4 lg:grid-cols-2">{savedStores.map((store) => <CustomerStoreCard key={store.id} store={store} saved />)}</div> : <CustomerEmptyState Icon={Heart} title="No saved stores" message="Save a store while browsing to keep it close at hand." href="/customer/stores" action="Browse stores" />}
      </section>
    </main>
  );
}
