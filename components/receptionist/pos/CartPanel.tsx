"use client";

import { useState, useTransition, type FormEvent } from "react";
import { CreditCard, Minus, Phone, Plus, Search, Trash2, UserPlus, UserRound, X, XCircle } from "lucide-react";
import {
  registerReceptionistCustomerAction,
  searchReceptionistCustomersAction,
  selectReceptionistCheckoutCustomerAction,
  type POSCustomerSummary
} from "@/app/dashboard/receptionist/actions";
import { Money } from "@/components/GreenChoiceDashboard";
import type { CartItem } from "@/components/receptionist/pos/pos-types";

function displayPhone(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, "");
  if (/^27[0-9]{9}$/.test(digits)) {
    const local = `0${digits.slice(2)}`;
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return phoneNumber;
}

function CustomerCheckoutModal({
  open,
  isCheckoutPending,
  onClose,
  onComplete
}: {
  open: boolean;
  isCheckoutPending: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [mode, setMode] = useState<"phone" | "name">("phone");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<POSCustomerSummary[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<POSCustomerSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isCustomerPending, startCustomerTransition] = useTransition();

  if (!open) return null;

  const busy = isCheckoutPending || isCustomerPending;

  function chooseMode(nextMode: "phone" | "name") {
    setMode(nextMode);
    setQuery("");
    setResults([]);
    setMessage(null);
  }

  function searchCustomers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSelectedCustomer(null);
    startCustomerTransition(async () => {
      const result = await searchReceptionistCustomersAction({ mode, query });
      if (!result.ok) {
        setResults([]);
        setMessage(result.message ?? "Customer search failed.");
        return;
      }
      setResults(result.customers);
      if (result.customers.length === 0) {
        setMessage("No matching customer was found in this store. You can register a new customer below.");
      }
    });
  }

  function registerCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startCustomerTransition(async () => {
      const result = await registerReceptionistCustomerAction({ firstName, surname, phoneNumber });
      if (!result.ok || !result.customer) {
        setMessage(result.message);
        return;
      }
      setSelectedCustomer(result.customer);
      setResults([result.customer]);
      setShowRegistration(false);
      setQuery(result.customer.phoneNumber);
      setMessage(result.message);
    });
  }

  function completeSale() {
    if (!selectedCustomer || busy) return;
    setMessage(null);
    startCustomerTransition(async () => {
      const result = await selectReceptionistCheckoutCustomerAction({ customerId: selectedCustomer.id });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      onClose();
      onComplete();
    });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/78 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="pos-customer-title">
      <div className="max-h-[min(820px,calc(100vh-2rem))] w-full max-w-2xl overflow-y-auto rounded-2xl border-2 border-emerald-400/45 bg-[#07100c] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.62),0_0_46px_rgba(34,197,94,0.12)] sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-white/15 pb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Checkout customer</p>
            <h2 id="pos-customer-title" className="mt-1 text-2xl font-extrabold text-white">Select Customer</h2>
            <p className="mt-2 text-sm leading-6 text-white/62">A customer must be linked to the sale before checkout can be completed.</p>
          </div>
          <button type="button" disabled={busy} onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/20 text-white/75 transition hover:border-white/45 hover:text-white disabled:opacity-40" aria-label="Close customer selection">
            <X size={19} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-white/18 bg-black/30 p-1.5">
          <button type="button" onClick={() => chooseMode("phone")} className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border font-bold transition ${mode === "phone" ? "border-emerald-300/70 bg-emerald-400/16 text-emerald-200" : "border-transparent text-white/60 hover:text-white"}`}>
            <Phone size={17} /> Cellphone
          </button>
          <button type="button" onClick={() => chooseMode("name")} className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border font-bold transition ${mode === "name" ? "border-emerald-300/70 bg-emerald-400/16 text-emerald-200" : "border-transparent text-white/60 hover:text-white"}`}>
            <UserRound size={17} /> Name
          </button>
        </div>

        <form onSubmit={searchCustomers} className="mt-4 flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{mode === "phone" ? "Search by cellphone number" : "Search by customer name"}</span>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              inputMode={mode === "phone" ? "tel" : "text"}
              autoComplete="off"
              placeholder={mode === "phone" ? "082 123 4567" : "Name or surname"}
              className="h-12 w-full rounded-xl border-2 border-white/22 bg-[#030806] px-4 text-white outline-none placeholder:text-white/32 focus:border-emerald-300/75"
            />
          </label>
          <button type="submit" disabled={busy || query.trim().length < 2} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-300/55 bg-emerald-500 px-5 font-extrabold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">
            <Search size={18} /> Search
          </button>
        </form>

        {message ? <p className="mt-3 rounded-xl border border-white/18 bg-black/25 px-4 py-3 text-sm leading-6 text-white/72">{message}</p> : null}

        {results.length > 0 ? (
          <div className="mt-4 space-y-2" aria-label="Customer search results">
            {results.map((customer) => {
              const selected = selectedCustomer?.id === customer.id;
              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => setSelectedCustomer(customer)}
                  className={`flex w-full items-center justify-between gap-4 rounded-xl border-2 px-4 py-3 text-left transition ${selected ? "border-emerald-300 bg-emerald-400/12" : "border-white/18 bg-black/20 hover:border-white/36"}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-extrabold text-white">{customer.firstName} {customer.surname}</span>
                    <span className="mt-1 block font-semibold text-emerald-300">{displayPhone(customer.phoneNumber)}</span>
                  </span>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${selected ? "border-emerald-300/70 text-emerald-200" : "border-white/20 text-white/55"}`}>{selected ? "Selected" : "Select"}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="mt-5 border-t border-white/15 pt-5">
          {!showRegistration ? (
            <button type="button" onClick={() => { setShowRegistration(true); setMessage(null); }} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-white/24 bg-black/20 font-extrabold text-white transition hover:border-emerald-300/60 hover:text-emerald-200">
              <UserPlus size={18} /> Register New Customer
            </button>
          ) : (
            <form onSubmit={registerCustomer} className="rounded-xl border-2 border-white/22 bg-black/25 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-white">Register New Customer</h3>
                  <p className="mt-1 text-xs text-white/50">Only name, surname and cellphone number are required.</p>
                </div>
                <button type="button" onClick={() => setShowRegistration(false)} className="text-sm font-bold text-white/55 hover:text-white">Cancel</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold text-white/72">Name
                  <input value={firstName} onChange={(event) => setFirstName(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border-2 border-white/20 bg-[#030806] px-3 text-white outline-none focus:border-emerald-300/70" />
                </label>
                <label className="text-sm font-bold text-white/72">Surname
                  <input value={surname} onChange={(event) => setSurname(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border-2 border-white/20 bg-[#030806] px-3 text-white outline-none focus:border-emerald-300/70" />
                </label>
                <label className="text-sm font-bold text-white/72 sm:col-span-2">Cellphone number
                  <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} inputMode="tel" placeholder="082 123 4567" className="mt-1.5 h-11 w-full rounded-lg border-2 border-white/20 bg-[#030806] px-3 text-white outline-none placeholder:text-white/30 focus:border-emerald-300/70" />
                </label>
              </div>
              <button type="submit" disabled={busy} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-emerald-300/55 bg-emerald-500 font-extrabold text-white transition hover:bg-emerald-400 disabled:opacity-40">
                {isCustomerPending ? <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <UserPlus size={17} />}
                Register & Select Customer
              </button>
            </form>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-white/15 pt-5 sm:flex-row sm:justify-end">
          <button type="button" disabled={busy} onClick={onClose} className="h-12 rounded-xl border-2 border-white/20 px-5 font-bold text-white/75 transition hover:border-white/40 hover:text-white disabled:opacity-40">Back</button>
          <button type="button" disabled={!selectedCustomer || busy} onClick={completeSale} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200/65 bg-emerald-500 px-6 font-extrabold text-white shadow-[0_0_28px_rgba(16,185,129,0.24)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-white/35 disabled:shadow-none">
            {busy ? <span className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <CreditCard size={19} />}
            {busy ? "Preparing checkout..." : "Complete Sale"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CartPanel({
  cart,
  subtotal,
  cartCount,
  isPending,
  onClearCart,
  onChangeQuantity,
  onRemoveItem,
  onCheckout
}: {
  cart: CartItem[];
  subtotal: number;
  cartCount: number;
  isPending: boolean;
  onClearCart: () => void;
  onChangeQuantity: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
}) {
  const [customerModalOpen, setCustomerModalOpen] = useState(false);

  return (
    <>
      <aside className="flex w-full max-h-[calc(100vh-130px)] flex-col rounded-xl border-2 border-white/45 bg-[linear-gradient(160deg,#101714,#07100c_52%,#030806)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] xl:max-h-[760px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold">Current Sale</h2>
          <button disabled={cart.length === 0 || isPending} onClick={onClearCart} className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 text-white/75 transition hover:border-red-200/45 hover:text-red-100 disabled:opacity-35" aria-label="Clear cart">
            <Trash2 size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {cart.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/35 bg-[#050b08] p-4 text-sm leading-6 text-white/58">Cart is empty. Add products to prepare a sale.</p>
          ) : (
            cart.map((item) => (
              <div key={item.productId} className="border-b border-white/10 py-4">
                <div className="flex gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/25">
                    {/* Product images can be Supabase URLs or local placeholders. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.imageSrc} alt={`${item.name} cart image`} className="size-full object-contain p-1" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3">
                      <p className="truncate font-semibold">{item.name}</p>
                      <p className="shrink-0"><Money value={item.unitPrice * item.quantity} /></p>
                    </div>
                    <p className="mt-1 text-sm text-white/68">{item.sizeLabel || item.subcategory}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <button onClick={() => onRemoveItem(item.productId)} className="text-xs text-white/50 hover:text-red-200">Remove</button>
                      <div className="flex h-8 items-center rounded-lg border border-white/12 bg-black/20">
                        <button onClick={() => onChangeQuantity(item.productId, -1)} className="grid size-8 place-items-center" aria-label={`Decrease ${item.name}`}>
                          <Minus size={15} />
                        </button>
                        <span className="min-w-9 text-center font-bold">{item.quantity}</span>
                        <button onClick={() => onChangeQuantity(item.productId, 1)} className="grid size-8 place-items-center" aria-label={`Increase ${item.name}`}>
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
          <p className="flex items-center justify-between gap-4 text-sm">
            <span className="text-white/72">Subtotal</span>
            <span className="shrink-0 font-semibold text-white"><Money value={subtotal} /></span>
          </p>
          <p className="flex items-center justify-between gap-4 text-sm">
            <span className="text-white/72">Tax (Included)</span>
            <span className="shrink-0 font-semibold text-white/86"><Money value={0} /></span>
          </p>
          <p className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
            <span className="text-lg font-extrabold text-white">Total</span>
            <span className="shrink-0 text-2xl font-extrabold text-emerald-400"><Money value={subtotal} /></span>
          </p>
        </div>

        <div className="mt-5 grid gap-2">
          <button disabled={cart.length === 0 || isPending} onClick={onClearCart} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/18 font-semibold text-white transition hover:border-red-200/45 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-45">
            <XCircle size={18} /> Cancel Sale
          </button>
          <button disabled={cart.length === 0 || isPending} onClick={() => setCustomerModalOpen(true)} aria-busy={isPending} className="inline-flex min-h-16 w-full touch-manipulation items-center justify-center gap-3 rounded-xl border border-emerald-200/55 bg-emerald-500 px-4 py-4 text-lg font-extrabold text-white shadow-[0_0_30px_rgba(16,185,129,0.36),0_14px_34px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:border-emerald-100 hover:bg-emerald-400 hover:shadow-[0_0_36px_rgba(16,185,129,0.46),0_16px_38px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.24)] active:scale-[0.99] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none motion-reduce:transition-none">
            {isPending ? <span className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" /> : <CreditCard size={24} />}
            {isPending ? "Processing checkout..." : `Checkout${cartCount ? ` (${cartCount})` : ""}`}
          </button>
        </div>
      </aside>

      <CustomerCheckoutModal
        open={customerModalOpen}
        isCheckoutPending={isPending}
        onClose={() => setCustomerModalOpen(false)}
        onComplete={onCheckout}
      />
    </>
  );
}
