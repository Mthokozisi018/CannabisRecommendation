import Link from "next/link";
import { Leaf, MapPin, Phone } from "lucide-react";
import { FavouriteButton } from "@/components/customer/FavouriteButton";
import type { CustomerStore } from "@/lib/customer/catalog";

export function CustomerStoreCard({ store, saved = false }: { store: CustomerStore; saved?: boolean }) {
  return (
    <article className="relative grid gap-4 rounded-2xl border-2 border-[#dfe5e1] bg-white p-4 shadow-[0_8px_28px_rgba(20,54,33,0.07)] sm:grid-cols-[112px_1fr_auto] sm:items-center">
      <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl border-2 border-[#d7e3da] bg-[#063822] text-emerald-300">
        {/* Store logos can be Supabase URLs configured per tenant. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {store.logoUrl ? <img src={store.logoUrl} alt={`${store.name} logo`} className="size-full object-cover" /> : <Leaf size={52} />}
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-xl font-black">{store.name}</h2>
        {store.address || store.city ? <p className="mt-2 flex items-start gap-2 text-sm text-[#5e6b63]"><MapPin className="mt-0.5 shrink-0" size={16} />{[store.address, store.city, store.province].filter(Boolean).join(", ")}</p> : null}
        {store.phoneNumber ? <p className="mt-2 flex items-center gap-2 text-sm text-[#5e6b63]"><Phone size={16} />{store.phoneNumber}</p> : null}
        <span className="mt-3 inline-flex rounded-full bg-[#def5e5] px-3 py-1 text-xs font-black text-[#087839]">Open for browsing</span>
      </div>
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
        <FavouriteButton targetType="store" targetId={store.id} initiallySaved={saved} />
        <Link href={`/customer/stores/${store.id}` as never} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#087c39] px-5 font-black text-white">Browse Store</Link>
      </div>
    </article>
  );
}
