"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Loader2, Phone, Search, UserPlus, X } from "lucide-react";
import { registerReceptionistCustomerAction, searchReceptionistCustomersAction } from "@/app/dashboard/receptionist/actions";
import type { SelectedPOSCustomer } from "@/components/receptionist/pos/pos-types";
import { customerFullName } from "@/lib/pos-customer-format";

type SearchMode = "phone" | "name";
type DialogMode = "search" | "register";

type CustomerCheckoutDialogProps = {
  open: boolean;
  selectedCustomer: SelectedPOSCustomer | null;
  totalLabel: string;
  isCompleting: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: SelectedPOSCustomer) => void;
  onCompleteSale: () => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold text-white/86">
      {label}
      {children}
    </label>
  );
}

export function CustomerCheckoutDialog({
  open,
  selectedCustomer,
  totalLabel,
  isCompleting,
  onClose,
  onSelectCustomer,
  onCompleteSale
}: CustomerCheckoutDialogProps) {
  const [dialogMode, setDialogMode] = useState<DialogMode>("search");
  const [searchMode, setSearchMode] = useState<SearchMode>("phone");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SelectedPOSCustomer[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSearching, startSearchTransition] = useTransition();
  const [isRegistering, startRegisterTransition] = useTransition();
  const searchSequence = useRef(0);
  const registrationLocked = useRef(false);
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!open) {
      searchSequence.current += 1;
      return;
    }
    if (dialogMode !== "search" || trimmedQuery.length < (searchMode === "phone" ? 3 : 2)) return;

    const sequence = ++searchSequence.current;
    const timeoutId = globalThis.setTimeout(() => {
      startSearchTransition(async () => {
        const response = await searchReceptionistCustomersAction({ mode: searchMode, query: trimmedQuery });
        if (sequence !== searchSequence.current) return;
        if (!response.ok) {
          setMessage(response.message);
          setResults([]);
          return;
        }
        setMessage(null);
        setResults(response.customers);
      });
    }, 250);

    return () => {
      globalThis.clearTimeout(timeoutId);
      searchSequence.current += 1;
    };
  }, [dialogMode, open, searchMode, trimmedQuery]);

  const registerDisabled = useMemo(
    () => !firstName.trim() || !surname.trim() || !phoneNumber.trim() || isRegistering,
    [firstName, isRegistering, phoneNumber, surname]
  );

  if (!open) return null;

  function showRegistration() {
    searchSequence.current += 1;
    setDialogMode("register");
    setMessage(null);
  }

  function showSearch() {
    setDialogMode("search");
    setMessage(null);
  }

  function submitRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (registerDisabled || registrationLocked.current) return;
    registrationLocked.current = true;

    startRegisterTransition(async () => {
      try {
        const response = await registerReceptionistCustomerAction({ firstName, surname, phoneNumber });
        if (!response.ok) {
          setMessage(response.message);
          return;
        }
        onSelectCustomer(response.customer);
        setQuery(response.customer.phoneNumber);
        setResults([response.customer]);
        setFirstName("");
        setSurname("");
        setPhoneNumber("");
        setDialogMode("search");
        setMessage(response.duplicate ? "Existing customer selected for this cellphone number." : "Customer registered and selected.");
      } finally {
        registrationLocked.current = false;
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/72 px-3 py-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="customer-checkout-title">
      <div className="mx-auto flex min-h-full w-full max-w-3xl items-center">
        <section className="relative w-full rounded-2xl border border-emerald-300/35 bg-[linear-gradient(160deg,#101714,#07100c_58%,#030806)] p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.1)] sm:p-6">
          <button type="button" onClick={onClose} className="absolute right-4 top-4 grid size-10 place-items-center rounded-full border border-white/10 text-white/72 transition hover:border-white/35 hover:text-white" aria-label="Close customer selection">
            <X size={18} />
          </button>

          <div className="pr-12">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-emerald-300/80">Checkout</p>
            <h2 id="customer-checkout-title" className="mt-2 text-3xl font-black leading-tight">Select Customer</h2>
            <p className="mt-2 text-sm leading-6 text-white/62">A customer must be linked before the sale can be completed.</p>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-black/22 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/42">Sale total</p>
                <p className="mt-1 text-2xl font-black text-emerald-300">{totalLabel}</p>
              </div>
              {selectedCustomer ? (
                <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm">
                  <p className="font-extrabold text-emerald-100">{selectedCustomer.fullName}</p>
                  <p className="mt-1 text-emerald-100/70">{selectedCustomer.phoneNumber}</p>
                </div>
              ) : null}
            </div>
          </div>

          {dialogMode === "search" ? (
            <div className="mt-5">
              <div className="inline-grid grid-cols-2 rounded-xl border border-white/12 bg-black/24 p-1" aria-label="Search customers by">
                {(["phone", "name"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setSearchMode(item);
                      setQuery("");
                      setResults([]);
                      setMessage(null);
                    }}
                    className={`h-10 rounded-lg px-4 text-sm font-extrabold transition ${searchMode === item ? "bg-emerald-400 text-[#04100a]" : "text-white/68 hover:bg-white/8 hover:text-white"}`}
                  >
                    {item === "phone" ? "Cellphone" : "Name"}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex min-h-13 items-center gap-3 rounded-xl border border-white/14 bg-black/24 px-4 focus-within:border-emerald-300/70">
                {searchMode === "phone" ? <Phone size={19} className="text-emerald-300" /> : <Search size={19} className="text-emerald-300" />}
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    if (event.target.value.trim().length < (searchMode === "phone" ? 3 : 2)) setResults([]);
                  }}
                  inputMode={searchMode === "phone" ? "tel" : "text"}
                  placeholder={searchMode === "phone" ? "082 123 4567" : "Search first name or surname"}
                  aria-label="Customer search"
                  className="min-h-13 min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-white/35"
                />
                {isSearching ? <Loader2 size={18} className="animate-spin text-white/58" aria-label="Searching customers" /> : null}
              </div>

              {message ? <p className="mt-4 rounded-xl border border-amber-200/25 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100">{message}</p> : null}

              <div className="mt-4 grid gap-3">
                {results.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => onSelectCustomer(customer)}
                    className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition ${selectedCustomer?.id === customer.id ? "border-emerald-200/70 bg-emerald-400/14" : "border-white/10 bg-white/[0.045] hover:border-emerald-300/45 hover:bg-emerald-400/8"}`}
                  >
                    <span>
                      <span className="block font-extrabold text-white">{customer.fullName}</span>
                      <span className="mt-1 block text-sm text-white/58">{customer.phoneNumber}</span>
                    </span>
                    {selectedCustomer?.id === customer.id ? <Check className="text-emerald-300" size={22} /> : null}
                  </button>
                ))}
                {trimmedQuery && !isSearching && results.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/14 bg-white/[0.035] px-4 py-4 text-center text-sm text-white/50">No matching customer found.</p>
                ) : null}
              </div>

              <div className="mt-5 border-t border-white/10 pt-5">
                <button type="button" onClick={showRegistration} className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-400/10 px-4 text-sm font-extrabold text-emerald-100 transition hover:border-emerald-200 hover:bg-emerald-400/18">
                  <UserPlus size={18} /> Register New Customer
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              {message ? <p className="mb-4 rounded-xl border border-amber-200/25 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100">{message}</p> : null}
              <form onSubmit={submitRegistration} className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-3">
                <Field label="Name">
                  <input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" className="mt-2 h-12 w-full rounded-lg border border-white/12 bg-black/28 px-3 font-semibold outline-none focus:border-emerald-300/70" />
                </Field>
                <Field label="Surname">
                  <input value={surname} onChange={(event) => setSurname(event.target.value)} autoComplete="family-name" className="mt-2 h-12 w-full rounded-lg border border-white/12 bg-black/28 px-3 font-semibold outline-none focus:border-emerald-300/70" />
                </Field>
                <Field label="Cellphone Number">
                  <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="082 123 4567" className="mt-2 h-12 w-full rounded-lg border border-white/12 bg-black/28 px-3 font-semibold outline-none focus:border-emerald-300/70" />
                </Field>
                <div className="flex flex-col gap-3 sm:col-span-3 sm:flex-row">
                  <button type="submit" disabled={registerDisabled} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 font-black text-[#04100a] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/35">
                    {isRegistering ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                    {isRegistering ? "Registering..." : "Register and Select"}
                  </button>
                  <button type="button" onClick={showSearch} disabled={isRegistering} className="h-12 rounded-xl border border-emerald-300/35 bg-black/28 px-5 font-extrabold text-emerald-100 transition hover:border-emerald-200 disabled:opacity-50">
                    Search Existing Customer
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" onClick={onClose} disabled={isCompleting || isRegistering} className="h-12 rounded-xl border border-white/14 px-5 font-bold text-white/72 transition hover:border-white/35 hover:text-white disabled:opacity-50">
              Back to Cart
            </button>
            <button type="button" disabled={!selectedCustomer || isCompleting || isRegistering} onClick={onCompleteSale} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 font-black text-[#04100a] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/35">
              {isCompleting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {isCompleting ? "Completing sale..." : `Complete Sale for ${selectedCustomer ? customerFullName(selectedCustomer.firstName, selectedCustomer.surname) : "Customer"}`}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
