import Link from "next/link";
import { Bike, Clock3, MapPin, ShoppingBag } from "lucide-react";
import { FavouriteButton } from "@/components/customer/FavouriteButton";
import { CustomerStoreImage } from "@/components/customer/CustomerStoreImage";
import type { CustomerStore } from "@/lib/customer/catalog";
import { getStoreOpenState } from "@/lib/customer/store-status";

export function CustomerStoreCard({ store, saved = false, compact = false, landingRow = false }: { store: CustomerStore; saved?: boolean; compact?: boolean; landingRow?: boolean }) {
  const openState = getStoreOpenState(store.openingHours);
  const address = [store.address, store.city, store.province].filter(Boolean).join(", ");
  const image = store.coverImageUrl || store.logoUrl;
  const cardClassName = landingRow
    ? "group relative w-full overflow-hidden rounded-2xl border border-[#354238] bg-[#08100b] shadow-[0_12px_28px_rgba(0,0,0,0.22)]"
    : `group relative overflow-hidden border border-[#2b3730] bg-[#08100b] ${compact ? "min-w-[17rem] max-w-[19rem]" : "w-full"}`;
  const linkClassName = compact ? "block" : landingRow ? "grid sm:grid-cols-[11rem_1fr] md:grid-cols-[12rem_1fr]" : "grid sm:grid-cols-[minmax(15rem,38%)_1fr]";
  const imageFrameClassName = landingRow
    ? "relative overflow-hidden bg-[#111a13] aspect-[16/8] sm:aspect-auto sm:h-full sm:min-h-36"
    : `relative overflow-hidden bg-[#111a13] ${compact ? "aspect-[16/9]" : "aspect-[16/8] sm:aspect-auto sm:min-h-52"}`;
  const titleClassName = compact ? "text-lg" : landingRow ? "text-lg sm:text-xl" : "text-xl";
  return (
    <article className={cardClassName}>
      <FavouriteButton targetType="store" targetId={store.id} initiallySaved={saved} className="absolute right-3 top-3 z-10 size-10 border-[#506053] bg-[#07100b] text-white shadow-[0_10px_22px_rgba(0,0,0,0.35)]" />
      <Link href={`/customer/stores/${store.id}`} className={linkClassName}>
        <div className={imageFrameClassName}>
          <CustomerStoreImage src={image} alt={store.coverImageAlt || `${store.name} storefront`} sizes={compact ? "304px" : "(max-width: 640px) 100vw, 38vw"} className="object-cover transition duration-300 group-hover:scale-[1.02]" />
          {openState ? <span className={`absolute left-3 top-3 rounded-lg border px-2.5 py-1 text-xs font-bold ${openState.open ? "border-[#6c991b] bg-[#142307] text-[#b7ef3e]" : "border-[#66422b] bg-[#21130d] text-[#efad75]"}`}>{openState.label}</span> : null}
        </div>
        <div className={landingRow ? "flex min-w-0 flex-col justify-center p-4 sm:p-5" : "min-w-0 p-4"}>
          <div className="min-w-0 pr-11"><h2 className={`${titleClassName} truncate font-black`}>{store.name}</h2>{store.description ? <p className="mt-1 line-clamp-1 text-sm leading-5 text-[#aeb8b0]">{store.description}</p> : null}</div>
          {address ? <p className="mt-2 flex items-start gap-2 text-sm text-[#aeb8b0]"><MapPin className="mt-0.5 shrink-0 text-[#9fdb27]" size={16} /><span className="line-clamp-1">{address}</span></p> : null}
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            {store.distanceKm !== null ? <span className="rounded-lg border border-[#334137] bg-[#101913] px-2.5 py-1.5">{store.distanceKm.toFixed(1)} km</span> : null}
            {store.fulfillment.collectionEnabled ? <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#42601e] bg-[#111d0a] px-2.5 py-1.5 text-[#b2e93f]"><ShoppingBag size={14} />Collection</span> : null}
            {store.fulfillment.deliveryEnabled ? <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#2b5f55] bg-[#0a1b17] px-2.5 py-1.5 text-[#77d8c4]"><Bike size={14} />Delivery</span> : null}
            {store.fulfillment.collectionLeadMinutes > 0 && store.fulfillment.collectionEnabled ? <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#334137] bg-[#101913] px-2.5 py-1.5 text-[#c3cbc5]"><Clock3 size={14} />{store.fulfillment.collectionLeadMinutes} min</span> : null}
          </div>
          <div className="mt-3 flex justify-end">
            <span className="inline-flex h-10 w-fit items-center rounded-xl border border-[#8ec51e] bg-[#122009] px-4 text-sm font-bold text-[#b5ee3c] shadow-[0_8px_18px_rgba(0,0,0,0.28)] transition group-hover:-translate-y-0.5 group-hover:border-[#a8e91d] group-hover:bg-[#17280b]">Browse store</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
