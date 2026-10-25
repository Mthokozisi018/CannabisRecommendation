"use client";

import { useActionState, useEffect } from "react";
import { saveCustomerAddressAction, type AddressActionState } from "@/app/customer/addresses/actions";
import type { CustomerAddress } from "@/lib/customer/address-validation";
import { SOUTH_AFRICAN_PROVINCES } from "@/lib/customer/provinces";

const input = "mt-2 min-h-12 w-full rounded-md border border-[#3b483f] bg-[#020604] px-3 text-white outline-none focus:border-[#a8e91d]";
const initial: AddressActionState = { ok: false, message: "" };

export function CustomerAddressForm({ address, onSaved, onCancel }: { address: CustomerAddress | null; onSaved: (message: string) => void; onCancel: () => void }) {
  const [state, action, pending] = useActionState(saveCustomerAddressAction, initial);
  useEffect(() => { if (state.ok) onSaved(state.message); }, [state, onSaved]);
  return <form action={action} className="mt-5 grid gap-4 rounded-md border border-[#405347] bg-[#08100b] p-5 sm:grid-cols-2">
    <h2 className="text-xl font-black sm:col-span-2">{address ? "Edit address" : "Add an address"}</h2>
    <input type="hidden" name="addressId" value={address?.id ?? ""} />
    <label className="font-bold">Label<input className={input} name="label" defaultValue={address?.label ?? "Home"} maxLength={40} required /></label>
    <label className="font-bold">Street address<input className={input} name="streetAddress" autoComplete="address-line1" defaultValue={address?.street_address ?? ""} minLength={3} maxLength={180} required /></label>
    <label className="font-bold">Unit or complex<input className={input} name="unitDetails" autoComplete="address-line2" defaultValue={address?.unit_details ?? ""} maxLength={100} /></label>
    <label className="font-bold">Suburb<input className={input} name="suburb" defaultValue={address?.suburb ?? ""} maxLength={100} required /></label>
    <label className="font-bold">City<input className={input} name="city" autoComplete="address-level2" defaultValue={address?.city ?? ""} maxLength={100} required /></label>
    <label className="font-bold">Province<select className={input} name="province" autoComplete="address-level1" defaultValue={address?.province ?? "Gauteng"}>{SOUTH_AFRICAN_PROVINCES.map((province) => <option key={province}>{province}</option>)}</select></label>
    <label className="font-bold">Postal code<input className={input} name="postalCode" autoComplete="postal-code" inputMode="numeric" defaultValue={address?.postal_code ?? ""} pattern="[0-9]{4}" maxLength={4} required /></label>
    {state.message ? <p role="alert" className="text-[#ffaaa3] sm:col-span-2">{state.message}</p> : null}
    <div className="flex flex-wrap gap-3 sm:col-span-2"><button disabled={pending} className="min-h-12 rounded-md bg-[#a8e91d] px-5 font-black text-[#081000] disabled:opacity-50">{pending ? "Saving…" : "Save address"}</button><button type="button" disabled={pending} onClick={onCancel} className="min-h-12 rounded-md border border-[#405347] px-5 font-bold">Cancel</button></div>
  </form>;
}
