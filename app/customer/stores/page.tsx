import { Store } from "lucide-react";
import Image from "next/image";
import { CustomerEmptyState } from "@/components/customer/CustomerEmptyState";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { CustomerStoreCard } from "@/components/customer/CustomerStoreCard";
import { requireCustomerSession } from "@/lib/customer/auth";
import { listCustomerStores } from "@/lib/customer/catalog";
import { listCustomerFavouriteIds } from "@/lib/customer/favourites";

export const metadata = { title: "Stores | GreenChoice" };

export default async function CustomerStoresPage() {
  const [, stores, favourites] = await Promise.all([
    requireCustomerSession(),
    listCustomerStores(),
    listCustomerFavouriteIds(),
  ]);

  return (
    <main className="min-h-screen">
      <CustomerHeader />
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
            title="No active stores yet"
            message="Active GreenChoice locations will appear here."
          />
        )}
      </section>
    </main>
  );
}
