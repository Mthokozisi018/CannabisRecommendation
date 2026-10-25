"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Check, ChevronDown, Clock3, MapPin, PackageCheck, Store } from "lucide-react";
import { updateOwnManagerStoreAction, type ManagerStoreActionState } from "@/app/dashboard/manager/store/actions";
import type { ManagerStoreSettings } from "@/lib/manager/store-settings";
import { southAfricanProvinces } from "@/lib/manager/onboarding-options";
import { storeDayKeys, type StoreDayKey } from "@/lib/manager/store-settings-fields";

const initialState: ManagerStoreActionState = { ok: false, message: "" };
const fieldShell = "mt-1.5 flex min-h-11 items-center gap-2.5 rounded-md border border-[#296646] bg-[#020805] px-3 text-white transition focus-within:border-[#53f095]";
const inputClass = "min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-[#7a9184] disabled:text-[#607268]";
const panelClass = "rounded-lg border border-[#36d179] bg-[#031008] p-4 text-white shadow-[0_18px_48px_rgba(0,0,0,0.42)] sm:p-5";

function Field({ name, label, defaultValue, type = "text", required = true, min, max, step, inputMode, children }: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  inputMode?: "text" | "tel" | "numeric" | "decimal" | "email";
  children?: ReactNode;
}) {
  return (
    <label className="block text-xs font-black uppercase tracking-normal text-[#cfe7d7]">
      {label}
      <span className={fieldShell}>
        <input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} min={min} max={max} step={step} inputMode={inputMode} className={inputClass} />
        {children}
      </span>
    </label>
  );
}

function Toggle({ name, label, description, defaultChecked }: { name: string; label: string; description: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[#296646] bg-[#07130d] p-3 transition hover:border-[#53f095]">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-[#23c875]" />
      <span>
        <span className="block text-sm font-black text-white">{label}</span>
        <span className="mt-0.5 block text-xs font-semibold leading-5 text-[#a9bbae]">{description}</span>
      </span>
    </label>
  );
}

function openingValue(openingHours: Record<string, unknown>, day: StoreDayKey) {
  const raw = openingHours[day] ?? openingHours[day.slice(0, 3)];
  if (typeof raw === "string") {
    const [open = "09:00", close = "17:00"] = raw.split(/\s*-\s*/, 2);
    return { closed: false, open, close };
  }
  if (raw && typeof raw === "object") {
    const value = raw as Record<string, unknown>;
    return {
      closed: value.closed === true || value.isClosed === true,
      open: typeof (value.open ?? value.opens) === "string" ? String(value.open ?? value.opens).slice(0, 5) : "09:00",
      close: typeof (value.close ?? value.closes) === "string" ? String(value.close ?? value.closes).slice(0, 5) : "17:00"
    };
  }
  return { closed: day === "sunday", open: "09:00", close: day === "saturday" ? "14:00" : "17:00" };
}

function OpeningHours({ openingHours }: { openingHours: Record<string, unknown> }) {
  const [closedDays, setClosedDays] = useState(() => Object.fromEntries(
    storeDayKeys.map((day) => [day, openingValue(openingHours, day).closed])
  ) as Record<StoreDayKey, boolean>);

  return (
    <section className={panelClass}>
      <div className="mb-4 flex items-center gap-2.5">
        <Clock3 size={20} className="text-[#8df2b1]" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-black">Opening Hours</h2>
          <p className="text-xs font-semibold text-[#a9bbae]">These hours determine the store status shown to customers.</p>
        </div>
      </div>
      <div className="grid gap-2">
        {storeDayKeys.map((day) => {
          const value = openingValue(openingHours, day);
          const closed = closedDays[day];
          return (
            <div key={day} className="grid gap-2 rounded-md border border-[#244f39] bg-[#07130d] p-3 sm:grid-cols-[130px_1fr_1fr_auto] sm:items-center">
              <span className="text-sm font-black capitalize text-white">{day}</span>
              <label className="text-xs font-bold text-[#cfe7d7]">Opens<input aria-label={`${day} opening time`} name={`${day}Open`} type="time" defaultValue={value.open} disabled={closed} required={!closed} className={`${fieldShell} ${inputClass} w-full`} /></label>
              <label className="text-xs font-bold text-[#cfe7d7]">Closes<input aria-label={`${day} closing time`} name={`${day}Close`} type="time" defaultValue={value.close} disabled={closed} required={!closed} className={`${fieldShell} ${inputClass} w-full`} /></label>
              <label className="inline-flex items-center gap-2 text-xs font-black text-[#cfe7d7]">
                <input name={`${day}Closed`} type="checkbox" checked={closed} onChange={(event) => setClosedDays((current) => ({ ...current, [day]: event.target.checked }))} className="size-4 accent-[#23c875]" />
                Closed
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ManagerStoreForm({ settings }: { settings: ManagerStoreSettings }) {
  const [state, action, pending] = useActionState(updateOwnManagerStoreAction, initialState);
  const fulfillment = settings.fulfillment;

  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={panelClass}>
          <div className="mb-4 flex items-center gap-2.5">
            <Store size={20} className="text-[#8df2b1]" aria-hidden="true" />
            <h2 className="text-lg font-black">Store Details</h2>
          </div>
          <div className="grid gap-3">
            <Field name="name" label="Store name" defaultValue={settings.name} />
            <label className="block text-xs font-black uppercase tracking-normal text-[#cfe7d7]">
              Customer-facing description
              <textarea name="publicDescription" defaultValue={settings.publicDescription} maxLength={1000} rows={5} className={`${fieldShell} ${inputClass} w-full resize-y py-3`} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="contactEmail" label="Contact email" defaultValue={settings.contactEmail} type="email" required={false} inputMode="email" />
              <Field name="phoneNumber" label="Phone number" defaultValue={settings.phoneNumber} inputMode="tel" />
            </div>
          </div>
        </section>

        <section className={panelClass}>
          <div className="mb-4 flex items-center gap-2.5">
            <MapPin size={20} className="text-[#8df2b1]" aria-hidden="true" />
            <h2 className="text-lg font-black">Store Address</h2>
          </div>
          <div className="grid gap-3">
            <Field name="physicalAddress" label="Physical store address" defaultValue={settings.physicalAddress} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="city" label="City" defaultValue={settings.city} />
              <label className="block text-xs font-black uppercase tracking-normal text-[#cfe7d7]">
                Province
                <span className={fieldShell}>
                  <select name="province" defaultValue={settings.province} required className={`${inputClass} appearance-none`}>
                    <option value="" className="bg-[#031008]">Select province</option>
                    {southAfricanProvinces.map((province) => <option key={province} value={province} className="bg-[#031008]">{province}</option>)}
                  </select>
                  <ChevronDown size={17} className="shrink-0 text-[#8df2b1]" />
                </span>
              </label>
            </div>
            <Field name="postalCode" label="Postal code" defaultValue={settings.postalCode} inputMode="numeric" />
          </div>
        </section>
      </div>

      <OpeningHours openingHours={settings.openingHours} />

      <section className={panelClass}>
        <div className="mb-4 flex items-center gap-2.5">
          <PackageCheck size={20} className="text-[#8df2b1]" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-black">Fulfillment Settings</h2>
            <p className="text-xs font-semibold text-[#a9bbae]">Control ordering, collection and delivery using the existing store fulfillment model.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Toggle name="ordersEnabled" label="Accept orders" description="Allow customers to place online orders." defaultChecked={fulfillment.ordersEnabled} />
          <Toggle name="collectionEnabled" label="Collection" description="Allow customers to collect orders in store." defaultChecked={fulfillment.collectionEnabled} />
          <Toggle name="deliveryEnabled" label="Delivery" description="Allow eligible customers to request delivery." defaultChecked={fulfillment.deliveryEnabled} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field name="collectionLeadMinutes" label="Collection lead time (minutes)" defaultValue={fulfillment.collectionLeadMinutes} type="number" min={0} max={1440} inputMode="numeric" />
          <Field name="collectionMinimum" label="Collection minimum (R)" defaultValue={fulfillment.collectionMinimum} type="number" min={0} step={0.01} inputMode="decimal" />
          <Field name="collectionFee" label="Collection fee (R)" defaultValue={fulfillment.collectionFee} type="number" min={0} step={0.01} inputMode="decimal" />
          <Field name="deliveryMinimum" label="Delivery minimum (R)" defaultValue={fulfillment.deliveryMinimum} type="number" min={0} step={0.01} inputMode="decimal" />
          <Field name="deliveryFee" label="Delivery fee (R)" defaultValue={fulfillment.deliveryFee} type="number" min={0} step={0.01} inputMode="decimal" />
          <Field name="deliveryRadiusKm" label="Delivery radius (km)" defaultValue={fulfillment.deliveryRadiusKm} type="number" min={0.01} max={500} step={0.01} inputMode="decimal" required={false} />
          <Field name="deliveryEtaMinMinutes" label="Minimum delivery ETA (minutes)" defaultValue={fulfillment.deliveryEtaMinMinutes} type="number" min={1} max={1440} inputMode="numeric" required={false} />
          <Field name="deliveryEtaMaxMinutes" label="Maximum delivery ETA (minutes)" defaultValue={fulfillment.deliveryEtaMaxMinutes} type="number" min={1} max={1440} inputMode="numeric" required={false} />
        </div>
      </section>

      {state.message ? <p role="status" className={`rounded-md border px-4 py-3 text-sm font-bold ${state.ok ? "border-[#48d984] bg-[#062112] text-[#d7ffe4]" : "border-[#e25454] bg-[#260707] text-[#ffd1d1]"}`}>{state.message}</p> : null}
      <button disabled={pending} className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-[#8df2b1] bg-[#23c875] px-5 text-sm font-black text-[#021009] transition hover:bg-[#61e99b] disabled:opacity-60">
        <Check size={18} aria-hidden="true" />
        {pending ? "Saving Store..." : "Save Store Settings"}
      </button>
    </form>
  );
}
