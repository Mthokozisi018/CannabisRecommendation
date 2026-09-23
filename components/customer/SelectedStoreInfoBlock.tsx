import { Clock3, Mail, MapPin, Phone, Store, type LucideIcon } from "lucide-react";
import type { CustomerStore } from "@/lib/customer/catalog";
import { getStoreOpenState, getStoreTradingHoursLabel } from "@/lib/customer/store-status";

function detailAddress(store: CustomerStore) {
  return [store.address, store.city, store.province, store.postalCode].filter(Boolean).join(", ");
}

function DetailSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-t border-[#2c3f30] pt-3 first:border-t-0 first:pt-0 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
      {children}
    </div>
  );
}

export function SelectedStoreInfoBlock({ store }: { store: CustomerStore }) {
  const openState = getStoreOpenState(store.openingHours);
  const status = openState ?? { open: false, label: "Closed" };
  const address = detailAddress(store) || "Address unavailable";
  const hours = getStoreTradingHoursLabel(store.openingHours);
  const contacts = [
    store.phoneNumber ? { Icon: Phone, label: store.phoneNumber } : null,
    store.contactEmail ? { Icon: Mail, label: store.contactEmail } : null,
  ].filter(Boolean) as Array<{ Icon: LucideIcon; label: string }>;

  return (
    <section aria-label="Selected store information" className="mb-3 max-w-5xl rounded-xl border-2 border-[#8ddf26] bg-[#05100a]/95 p-3 text-white shadow-[0_0_24px_rgba(141,223,38,0.28),0_16px_38px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.75fr)_minmax(11rem,0.75fr)_minmax(10rem,0.65fr)] sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-lg border-2 border-[#8ddf26] bg-[#102008] text-[#b8f13b] shadow-[0_0_16px_rgba(141,223,38,0.18)] sm:size-14">
            <Store size={27} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black text-[#a8e91d] sm:text-sm">You are shopping at</p>
            <h1 className="truncate text-lg font-black leading-tight sm:text-xl">{store.name}</h1>
            <p className="mt-1 flex min-w-0 items-start gap-1.5 text-xs font-medium leading-5 text-[#d8dfd9] sm:text-sm">
              <MapPin className="mt-0.5 shrink-0 text-[#a8e91d]" size={15} aria-hidden="true" />
              <span className="line-clamp-2">{address}</span>
            </p>
          </div>
        </div>

        <DetailSection>
          <p className={`flex items-center gap-2 text-sm font-black ${status.open ? "text-[#21e99c]" : "text-[#ffb27a]"}`}>
            <Clock3 className="shrink-0 text-[#d8dfd9]" size={19} aria-hidden="true" />
            {status.label}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#d8dfd9]">{hours}</p>
        </DetailSection>

        <DetailSection>
          {contacts.length ? (
            <div className="grid gap-1.5">
              {contacts.map(({ Icon, label }) => (
                <p key={label} className="flex items-center gap-2 text-sm font-semibold text-[#d8dfd9]">
                  <Icon className="shrink-0 text-[#d8dfd9]" size={18} aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold text-[#d8dfd9]">Contact unavailable</p>
          )}
        </DetailSection>
      </div>
    </section>
  );
}
