"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus } from "lucide-react";
import { deleteCustomerAddressAction, setDefaultCustomerAddressAction, type AddressActionState } from "@/app/customer/addresses/actions";
import { CustomerAddressCard } from "@/components/customer/CustomerAddressCard";
import { CustomerAddressDeleteDialog } from "@/components/customer/CustomerAddressDeleteDialog";
import { CustomerAddressForm } from "@/components/customer/CustomerAddressForm";
import { CustomerEmptyState } from "@/components/customer/CustomerEmptyState";
import type { CustomerAddress } from "@/lib/customer/address-validation";

export function CustomerAddresses({ addresses }: { addresses: CustomerAddress[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CustomerAddress | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<CustomerAddress | null>(null);
  const [notice, setNotice] = useState<AddressActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const onSaved = useCallback((message: string) => { setEditing(undefined); setNotice({ ok: true, message }); router.refresh(); }, [router]);
  function mutate(action: () => Promise<AddressActionState>) {
    startTransition(async () => {
      try {
        const result = await action();
        setNotice(result);
        if (result.ok) { setDeleting(null); router.refresh(); }
      } catch { setNotice({ ok: false, message: "We could not update your addresses. Please try again." }); }
    });
  }
  return <>
    <button type="button" onClick={() => { setEditing(null); setNotice(null); }} disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-[#a8e91d] px-5 font-black text-[#081000]"><Plus size={19} />Add address</button>
    {notice ? <p role={notice.ok ? "status" : "alert"} className={`mt-4 border border-[#405347] bg-[#08100b] p-3 ${notice.ok ? "text-[#a8e91d]" : "text-[#ffaaa3]"}`}>{notice.message}</p> : null}
    {editing !== undefined ? <CustomerAddressForm key={editing?.id ?? "new"} address={editing} onSaved={onSaved} onCancel={() => setEditing(undefined)} /> : null}
    <div className="mt-5 grid gap-4 sm:grid-cols-2">{addresses.map((address) => <CustomerAddressCard key={address.id} address={address} busy={pending} onEdit={() => { setEditing(address); setNotice(null); }} onDelete={() => setDeleting(address)} onDefault={() => mutate(() => setDefaultCustomerAddressAction(address.id))} />)}</div>
    {!addresses.length && editing === undefined ? <div className="mt-5"><CustomerEmptyState Icon={MapPin} title="No saved addresses" message="Add your first address. It becomes your default address for checkout." /></div> : null}
    {deleting ? <CustomerAddressDeleteDialog address={deleting} pending={pending} error={notice && !notice.ok ? notice.message : undefined} onClose={() => setDeleting(null)} onDelete={() => mutate(() => deleteCustomerAddressAction(deleting.id))} /> : null}
  </>;
}
