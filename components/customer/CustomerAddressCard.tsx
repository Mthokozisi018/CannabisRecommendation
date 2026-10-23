import { MapPin, Pencil, Trash2 } from "lucide-react";
import type { CustomerAddress } from "@/lib/customer/address-validation";

export function CustomerAddressCard({ address, busy, onEdit, onDelete, onDefault }: { address: CustomerAddress; busy: boolean; onEdit: () => void; onDelete: () => void; onDefault: () => void }) {
  return <article className="rounded-md border border-[#2d3931] bg-[#08100b] p-5">
    <div className="flex items-center gap-3"><MapPin className="shrink-0 text-[#a8e91d]" size={21} /><h2 className="min-w-0 flex-1 break-words text-lg font-black">{address.label}</h2>{address.is_default ? <span className="rounded-full border border-[#86b724] bg-[#14230b] px-3 py-1 text-xs font-bold text-[#a8e91d]">Default</span> : null}</div>
    <p className="mt-3 break-words leading-6 text-[#aab4ac]">{[address.street_address, address.unit_details, address.suburb, address.city, address.province, address.postal_code].filter(Boolean).join(", ")}</p>
    <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={onEdit} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#405347] px-3 font-bold disabled:opacity-50" aria-label={`Edit ${address.label} address`}><Pencil size={16} />Edit</button><button disabled={busy} onClick={onDelete} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#71453f] px-3 font-bold text-[#ffaaa3] disabled:opacity-50" aria-label={`Delete ${address.label} address`}><Trash2 size={16} />Delete</button>{!address.is_default ? <button disabled={busy} onClick={onDefault} className="min-h-11 rounded-md border border-[#86b724] px-3 font-bold text-[#a8e91d] disabled:opacity-50">Use as default</button> : null}</div>
  </article>;
}
