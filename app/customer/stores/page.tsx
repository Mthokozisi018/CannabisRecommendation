import { MapPinned, Search } from "lucide-react";
import Link from "next/link";
import { CustomerStoreCard } from "@/components/customer/CustomerStoreCard";
import { listCustomerStores } from "@/lib/customer/catalog";
import { listCustomerFavouriteIds } from "@/lib/customer/favourites";

export const metadata = { title: "Stores | GreenChoice" };

export default async function CustomerStoresPage({ searchParams }: { searchParams: Promise<{ search?: string; saved?: string }> }) {
  const params = await searchParams;
  const [stores, favourites] = await Promise.all([listCustomerStores(params.search), listCustomerFavouriteIds()]);
  const visibleStores = params.saved === "true" ? stores.filter((store) => favourites.storeIds.includes(store.id)) : stores;
  return (
    <main>
      <section className="bg-[linear-gradient(135deg,#063d28,#01281b)] px-4 pb-8 pt-7 text-white sm:px-6"><div className="mx-auto max-w-4xl"><div className="flex items-center justify-between"><div><h1 className="text-4xl font-black">Stores</h1><p className="mt-2 text-white/75">Find active GreenChoice stores.</p></div><MapPinned size={42} className="text-emerald-300" /></div><form className="mt-6 flex h-14 items-center gap-3 rounded-2xl bg-white px-4 text-[#15241b]"><Search className="text-[#758179]" /><input name="search" defaultValue={params.search} className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Search stores..." /><button className="rounded-xl bg-[#087c39] px-4 py-2 font-black text-white">Search</button></form></div></section>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6"><nav className="mb-6 flex gap-3"><Link href="/customer/stores" className={`rounded-full border-2 px-5 py-2 text-sm font-black ${params.saved !== "true" ? "border-[#087c39] bg-[#087c39] text-white" : "border-[#d5dfd8] bg-white"}`}>All Stores</Link><Link href="/customer/stores?saved=true" className={`rounded-full border-2 px-5 py-2 text-sm font-black ${params.saved === "true" ? "border-[#087c39] bg-[#087c39] text-white" : "border-[#d5dfd8] bg-white"}`}>Favorites</Link></nav><div className="grid gap-4">{visibleStores.map((store) => <CustomerStoreCard key={store.id} store={store} saved={favourites.storeIds.includes(store.id)} />)}{visibleStores.length === 0 ? <div className="rounded-2xl border-2 border-[#dfe6e1] bg-white p-10 text-center text-[#65736a]">No matching active stores were found.</div> : null}</div></div>
    </main>
  );
}
