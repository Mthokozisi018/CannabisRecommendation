import { CustomerProductGrid } from "@/components/customer/CustomerProductGrid";
import { CustomerStoreCard } from "@/components/customer/CustomerStoreCard";
import { listCustomerProducts, listCustomerStores } from "@/lib/customer/catalog";
import { listCustomerFavouriteIds } from "@/lib/customer/favourites";

export const metadata = { title: "Saved | GreenChoice" };
export default async function CustomerSavedPage() {
  const [stores, products, favourites] = await Promise.all([listCustomerStores(), listCustomerProducts({ limit: 500 }), listCustomerFavouriteIds()]);
  const savedStores = stores.filter((store) => favourites.storeIds.includes(store.id));
  const savedProducts = products.filter((product) => favourites.productIds.includes(product.id));
  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-7 sm:px-6"><h1 className="text-4xl font-black">Saved</h1><p className="mt-2 text-[#647168]">Your saved stores and products.</p><section className="mt-8"><h2 className="mb-4 text-2xl font-black">Stores</h2><div className="grid gap-4">{savedStores.map((store) => <CustomerStoreCard key={store.id} store={store} saved />)}{savedStores.length === 0 ? <p className="rounded-2xl border-2 border-[#dfe6e1] bg-white p-8 text-center text-[#65736a]">You have not saved any stores yet.</p> : null}</div></section><section className="mt-9"><h2 className="mb-4 text-2xl font-black">Products</h2>{savedProducts.length ? <CustomerProductGrid products={savedProducts} savedProductIds={favourites.productIds} /> : <p className="rounded-2xl border-2 border-[#dfe6e1] bg-white p-8 text-center text-[#65736a]">You have not saved any products yet.</p>}</section></main>;
}

