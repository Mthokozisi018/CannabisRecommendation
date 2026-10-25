"use client";

import { useEffect, useRef } from "react";
import type { CustomerAddress } from "@/lib/customer/address-validation";

export function CustomerAddressDeleteDialog({ address, pending, error, onClose, onDelete }: { address: CustomerAddress; pending: boolean; error?: string; onClose: () => void; onDelete: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} onCancel={(event) => { if (pending) event.preventDefault(); else onClose(); }} aria-labelledby="delete-address-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-md border border-[#405347] bg-[#08100b] p-6 text-white backdrop:bg-black/80">
    <h2 id="delete-address-title" className="text-xl font-black">Delete {address.label}?</h2><p className="mt-3 text-[#aab4ac]">This removes the saved address. Previous order addresses remain in your order history.</p>
    {address.is_default ? <p className="mt-3 text-sm text-[#aab4ac]">Choose another default address after deleting this one.</p> : null}
    <div className="mt-5 flex gap-3"><button autoFocus disabled={pending} onClick={onClose} className="min-h-11 rounded-md border border-[#405347] px-4 font-bold">Keep address</button><button disabled={pending} onClick={onDelete} className="min-h-11 rounded-md bg-[#843931] px-4 font-bold text-white">{pending ? "Deleting…" : "Delete address"}</button></div>
    {error ? <p role="alert" className="mt-4 text-[#ffaaa3]">{error}</p> : null}
  </dialog>;
}
