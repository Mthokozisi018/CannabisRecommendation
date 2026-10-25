"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Banknote, Check, CreditCard, Leaf, Loader2, LockKeyhole, MapPin, Minus, Plus, Search, Split, Trash2, UserRound, Wifi, X } from "lucide-react";
import { StaffCustomerOnboarding } from "@/components/registration/StaffCustomerOnboarding";
import { accountFirstName, accountRoleTitle, type AccountRole, type DashboardAccountProfile } from "@/components/account/account-types";
import { Money } from "@/components/GreenChoiceDashboard";
import { CheckoutStepBadge } from "@/components/receptionist/pos/CheckoutStepBadge";
import type { CartItem, SelectedPOSCustomer } from "@/components/receptionist/pos/pos-types";
import { paymentError, type POSPayment } from "@/lib/pos-payment";
import { customerFullName } from "@/lib/pos-customer-format";

type SearchMode = "phone" | "name";

type CustomerCheckoutDialogProps = {
  initialCustomerQuery?: string;
  open: boolean;
  cart: CartItem[];
  cartCount: number;
  selectedCustomer: SelectedPOSCustomer | null;
  totalLabel: string;
  total: number;
  checkoutError?: string;
  isCompleting: boolean;
  storeName: string;
  profileLabel: string;
  accountRole: AccountRole;
  accountProfile?: DashboardAccountProfile;
  onClose: () => void;
  onClearCart: () => void;
  onChangeQuantity: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onSelectCustomer: (customer: SelectedPOSCustomer) => void;
  onCompleteSale: (payment: POSPayment) => void;
};

const CUSTOMER_SEARCH_DEBOUNCE_MS = 250;
const VAT_INCLUDED = 0;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-bold text-white/82">
      {label}
      {children}
    </label>
  );
}

function compactPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("27")) return `0${digits.slice(2)}`.slice(0, 10);
  if (/^[6-8]/.test(digits)) return `0${digits}`.slice(0, 10);
  return digits.slice(0, 10);
}

function safeNameTerm(value: string) {
  return value.replace(/[^\p{L}\p{N} '-]/gu, "").trim();
}

function searchModeFor(value: string): SearchMode {
  const digits = compactPhoneDigits(value);
  return digits.length >= 3 && /^[+\d\s().-]+$/.test(value.trim()) ? "phone" : "name";
}

function parseAmount(value: string) {
  return value.trim() ? Number(value) : NaN;
}

function initials(firstName?: string, surname?: string) {
  const chars = [firstName?.trim()[0], surname?.trim()[0]].filter(Boolean).join("");
  return (chars || "GC").slice(0, 2).toUpperCase();
}

function staffName(profile: DashboardAccountProfile | undefined, fallback: string) {
  if (!profile) return fallback;
  const fullName = customerFullName(profile.firstName, profile.surname);
  return fullName || accountFirstName(profile);
}

function ProductThumb({ item }: { item: CartItem }) {
  return (
    <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-white/10 bg-[#08130f] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      {/* Product images can be Supabase URLs or local placeholders. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.imageSrc} alt={`${item.name} checkout item`} className="size-full object-contain p-1" />
    </div>
  );
}

export function CustomerCheckoutDialog({
  initialCustomerQuery = "",
  open,
  cart,
  cartCount,
  selectedCustomer,
  totalLabel,
  total,
  checkoutError,
  isCompleting,
  storeName,
  profileLabel,
  accountRole,
  accountProfile,
  onClose,
  onClearCart,
  onChangeQuantity,
  onRemoveItem,
  onSelectCustomer,
  onCompleteSale
}: CustomerCheckoutDialogProps) {
  const [query, setQuery] = useState(initialCustomerQuery);
  const [results, setResults] = useState<SelectedPOSCustomer[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [searchRefresh, setSearchRefresh] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [resolvedSearchKey, setResolvedSearchKey] = useState<string | null>(null);
  const [method, setMethod] = useState<POSPayment["method"] | "">("");
  const [cashAmount, setCashAmount] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [cartSearch, setCartSearch] = useState("");
  const [cartCategory, setCartCategory] = useState("All");
  const customerCacheRef = useRef(new Map<string, SelectedPOSCustomer[]>());
  const latestSearchRef = useRef(0);

  const trimmedQuery = query.trim();
  const searchMode = useMemo(() => searchModeFor(trimmedQuery), [trimmedQuery]);
  const searchLength = searchMode === "phone" ? compactPhoneDigits(trimmedQuery).length : safeNameTerm(trimmedQuery).length;
  const searchReady = trimmedQuery.length > 0 && searchLength >= (searchMode === "phone" ? 3 : 2);
  const searchKey = searchReady ? `${searchMode}:${trimmedQuery.toLowerCase()}` : "";
  const selectedStaffName = staffName(accountProfile, profileLabel);

  const cartCategories = useMemo(() => {
    const categories = Array.from(new Set(cart.map((item) => item.categoryName).filter(Boolean)));
    return ["All", ...categories];
  }, [cart]);
  const activeCartCategory = cartCategories.includes(cartCategory) ? cartCategory : "All";

  const displayedCart = useMemo(() => {
    const term = cartSearch.trim().toLowerCase();
    return cart.filter((item) => {
      const matchesCategory = activeCartCategory === "All" || item.categoryName === activeCartCategory;
      const matchesSearch =
        !term ||
        [item.name, item.categoryName, item.subcategory, item.sizeLabel]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }, [activeCartCategory, cart, cartSearch]);

  const payment = useMemo<POSPayment | null>(() => {
    if (!method) return null;
    if (method === "cash") return { method, cashAmount: total, cardAmount: 0 };
    if (method === "card") return { method, cashAmount: 0, cardAmount: total };
    return { method, cashAmount: parseAmount(cashAmount), cardAmount: parseAmount(cardAmount) };
  }, [cardAmount, cashAmount, method, total]);

  const validationMessage = !method ? "Select a payment method." : payment ? paymentError(payment, total) : "Select a payment method.";
  const completionDisabled = cart.length === 0 || !selectedCustomer || isCompleting || Boolean(validationMessage);

  useEffect(() => {
    if (!open || !searchReady) {
      return;
    }

    const cached = searchMode === "name" ? customerCacheRef.current.get(searchKey) : undefined;
    if (cached) {
      const cacheTimer = globalThis.setTimeout(() => {
        setResults(cached);
        setMessage(null);
        setIsSearching(false);
        setResolvedSearchKey(searchKey);
      }, 0);
      return () => globalThis.clearTimeout(cacheTimer);
    }

    const controller = new AbortController();
    const requestId = ++latestSearchRef.current;
    const timeoutId = globalThis.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch("/api/dashboard/receptionist/customers/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: searchMode, query: trimmedQuery }),
          signal: controller.signal,
          cache: "no-store"
        });
        const result = await response.json();
        if (controller.signal.aborted || latestSearchRef.current !== requestId) return;
        if (!response.ok || !result.ok) throw new Error(result.message || "Customer search failed.");
        const customers = Array.isArray(result.customers) ? result.customers : [];
        if (searchMode === "name") customerCacheRef.current.set(searchKey, customers);
        setMessage(null);
        setResults(customers);
        setResolvedSearchKey(searchKey);
      } catch (error) {
        if (controller.signal.aborted || latestSearchRef.current !== requestId) return;
        setMessage(error instanceof Error ? error.message : "Customer search failed.");
        setResults([]);
        setResolvedSearchKey(searchKey);
      } finally {
        if (!controller.signal.aborted && latestSearchRef.current === requestId) setIsSearching(false);
      }
    }, CUSTOMER_SEARCH_DEBOUNCE_MS);

    return () => {
      globalThis.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [open, searchRefresh, searchKey, searchMode, searchReady, trimmedQuery]);

  if (!open) return null;

  function selectCustomer(customer: SelectedPOSCustomer) {
    onSelectCustomer(customer);
    setMessage(null);
    setResults((current) => current.some((item) => item.id === customer.id) ? current : [customer, ...current].slice(0, 8));
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/72 px-2 py-4 backdrop-blur-md sm:px-4" role="dialog" aria-modal="true" aria-labelledby="customer-checkout-title">
      <div className="mx-auto flex min-h-full w-full max-w-[900px] items-center">
        <section className="relative max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-[10px] border border-[#0b7b58] bg-[#020b08] text-white shadow-[0_28px_90px_rgba(0,0,0,0.65),0_0_42px_rgba(16,185,129,0.12),inset_0_1px_0_rgba(255,255,255,0.08)] sm:max-h-[min(680px,calc(100dvh-4rem))]">
          <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-md border border-white/10 bg-[#06130f] text-white/72 transition hover:border-white/35 hover:text-white" aria-label="Close checkout">
            <X size={17} />
          </button>

          <header className="grid gap-2 border-b border-[#0f3c30] bg-[linear-gradient(90deg,#04130f,#02100c_52%,#06120f)] px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-center sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-md border border-[#19d99a]/35 bg-[#062018] text-[#22e6a8]">
                <Leaf size={24} />
              </span>
              <div className="min-w-0">
                <h2 id="customer-checkout-title" className="truncate text-lg font-black leading-tight">
                  Green<span className="text-[#1ce6a3]">Choice</span>
                </h2>
                <p className="text-xs font-bold text-[#1ce6a3]/80">Receptionist POS</p>
              </div>
            </div>

            <div className="grid gap-2 pr-10 text-xs sm:flex sm:items-center sm:pr-8">
              <div className="flex min-w-0 items-center gap-2 border-[#113a2f] sm:border-r sm:pr-4">
                <MapPin size={17} className="shrink-0 text-[#1ce6a3]" />
                <div className="min-w-0">
                  <p className="truncate font-black text-white">{storeName}</p>
                  <p className="flex items-center gap-1 text-[#61f2c0]/82"><span className="size-1.5 rounded-full bg-[#1ce6a3]" /> Online</p>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-2 sm:pl-1">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1ce6a3] text-sm font-black text-[#02110c]">
                  {initials(accountProfile?.firstName, accountProfile?.surname)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-black text-white">{selectedStaffName}</p>
                  <p className="text-white/58">{accountRoleTitle(accountRole)}</p>
                </div>
              </div>
            </div>
          </header>

          <div className="grid gap-2 p-3">
            <section className="rounded-lg border border-[#0b7b58]/70 bg-[linear-gradient(135deg,#021410,#03100c_54%,#04130e)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <CheckoutStepBadge step={1} />
                  <UserRound size={24} className="shrink-0 text-[#1ce6a3]" />
                  <div className="min-w-0">
                    <h3 className="text-base font-black">Select Customer</h3>
                    <p className="text-xs text-white/52">Search by name or cellphone</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2"><StaffCustomerOnboarding onRegistered={phoneNumber => {
                  customerCacheRef.current.clear(); setQuery(phoneNumber); setResults([]); setMessage(null); setResolvedSearchKey(null); setSearchRefresh(value => value + 1);
                }} /></div>
              </div>

              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_14rem]">
                <div className="min-w-0">
                  <div className="flex h-9 items-center gap-2 rounded-md border border-[#18d397]/80 bg-[#03100c] px-3 shadow-[0_0_18px_rgba(28,230,163,0.12)] focus-within:border-[#5ff3bf]">
                    <Search size={18} className="shrink-0 text-white/72" />
                    <input
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setResults([]);
                        setMessage(null);
                        setResolvedSearchKey(null);
                        setIsSearching(false);
                      }}
                      aria-label="Customer search"
                      inputMode={searchMode === "phone" ? "tel" : "text"}
                      placeholder="Search customers"
                      className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-white/36"
                    />
                    {query ? (
                      <button type="button" onClick={() => { setQuery(""); setResults([]); setMessage(null); setResolvedSearchKey(null); }} className="grid size-7 place-items-center rounded-md text-white/42 transition hover:bg-white/8 hover:text-white" aria-label="Clear customer search">
                        <X size={15} />
                      </button>
                    ) : null}
                    {isSearching ? <Loader2 size={17} className="animate-spin text-[#88f4c7]" aria-label="Searching customers" /> : null}
                  </div>

                  {message ? <p className="mt-3 rounded-md border border-amber-200/25 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100">{message}</p> : null}

                  <div className="mt-2 grid max-h-24 gap-1 overflow-y-auto pr-1">
                    {results.map((customer) => {
                      const selected = selectedCustomer?.id === customer.id;
                      return (
                        <div key={customer.id} className={`grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-3 py-2 ${selected ? "border-[#15e49d] bg-[#0c4a38]" : "border-white/10 bg-[#071711] hover:border-[#1ce6a3]/45"}`}>
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-black ${selected ? "bg-[#1ce6a3] text-[#02110c]" : "bg-[#9fb3c8] text-[#102030]"}`}>
                              {initials(customer.firstName, customer.surname)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-black">{customer.fullName}</p>
                              <p className="truncate text-[11px] text-white/58">{customer.phoneNumber}</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => selectCustomer(customer)} className={`h-7 rounded-md border px-3 text-[11px] font-black transition ${selected ? "border-[#1ce6a3]/70 bg-[#063225] text-[#bfffe8]" : "border-white/16 bg-[#06130f] text-white/86 hover:border-[#1ce6a3]/70 hover:text-[#bfffe8]"}`} aria-label={`Select ${customer.fullName}`}>
                            {selected ? "Selected" : "Select"}
                          </button>
                        </div>
                      );
                    })}
                    {searchReady && !isSearching && resolvedSearchKey === searchKey && results.length === 0 ? (
                      <p className="rounded-md border border-dashed border-white/14 bg-[#06130f] px-3 py-3 text-center text-xs font-bold text-white/48">No customers found.</p>
                    ) : null}
                  </div>
                </div>

                <aside className="rounded-lg border border-white/10 bg-[#06130f] p-2">
                  {selectedCustomer ? (
                    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
                      <span className="grid size-9 place-items-center rounded-full bg-[#1ce6a3] text-sm font-black text-[#02110c]">{initials(selectedCustomer.firstName, selectedCustomer.surname)}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-black">{selectedCustomer.fullName}</p>
                        <p className="mt-1 text-xs text-white/58">{selectedCustomer.phoneNumber}</p>
                      </div>
                      <p className="col-span-2 w-fit rounded-md border border-[#1ce6a3]/25 bg-[#08291f] px-2 py-1 text-[11px] font-black text-[#79f2c1]">Linked to sale</p>
                    </div>
                  ) : (
                    <div className="grid min-h-16 place-items-center rounded-md border border-dashed border-white/12 text-center text-xs font-bold text-white/45">
                      Customer required
                    </div>
                  )}
                </aside>
              </div>

            </section>

            <section className="grid gap-3 rounded-lg border border-[#0b7b58]/70 bg-[linear-gradient(135deg,#02120e,#03100c_54%,#04120e)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] lg:grid-cols-[minmax(0,1fr)_12rem]">
              <div className="min-w-0">
                <div className="mb-2 grid gap-2 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
                  <div className="flex items-center gap-3">
                    <CheckoutStepBadge step={2} />
                    <CreditCard size={24} className="text-[#1ce6a3]" />
                    <h3 className="text-base font-black">Current Sale</h3>
                  </div>
                  <div className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-white/12 bg-[#03100c] px-2 focus-within:border-[#1ce6a3]/65">
                    <Search size={16} className="shrink-0 text-white/48" />
                    <input value={cartSearch} onChange={(event) => setCartSearch(event.target.value)} aria-label="Search sale items" placeholder="Search sale items" className="min-w-0 flex-1 bg-transparent text-xs font-bold outline-none placeholder:text-white/35" />
                  </div>
                  <button type="button" onClick={onClose} className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-white/12 bg-[#06130f] px-3 text-xs font-black text-white/78 transition hover:border-[#1ce6a3]/60 hover:text-[#c8ffeb]">
                    Add Products
                  </button>
                </div>

                <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                  {cartCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setCartCategory(category)}
                      className={`h-8 shrink-0 rounded-md border px-3 text-xs font-black transition ${cartCategory === category ? "border-[#1ce6a3] bg-[#1ce6a3] text-[#02110c]" : "border-white/10 bg-[#06130f] text-white/62 hover:border-white/28 hover:text-white"}`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                <div className="overflow-hidden rounded-lg border border-white/10 bg-[#03100c]">
                  <div className="hidden grid-cols-[1.5rem_minmax(0,1fr)_4.25rem_6.5rem_5rem_2.25rem] gap-2 border-b border-white/10 bg-[#071a14] px-2 py-2 text-[11px] font-black text-white/60 lg:grid">
                    <span>#</span>
                    <span>Product</span>
                    <span>Price</span>
                    <span>Qty</span>
                    <span>Total</span>
                    <span />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {displayedCart.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm font-bold text-white/45">{cart.length === 0 ? "Cart is empty." : "No sale items match."}</p>
                    ) : (
                      displayedCart.map((item, index) => (
                        <div key={item.productId} className="grid gap-2 border-b border-white/8 px-2 py-2 last:border-b-0 lg:grid-cols-[1.5rem_minmax(0,1fr)_4.25rem_6.5rem_5rem_2.25rem] lg:items-center">
                          <span className="hidden text-xs text-white/62 lg:block">{index + 1}</span>
                          <div className="flex min-w-0 items-center gap-2">
                            <ProductThumb item={item} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black">{item.name}</p>
                              <p className="truncate text-xs text-white/50">{item.sizeLabel || item.subcategory || item.categoryName}</p>
                            </div>
                          </div>
                          <p className="text-sm font-bold"><Money value={item.unitPrice} /></p>
                          <div className="flex h-8 w-fit items-center rounded-md border border-white/12 bg-[#08140f]">
                            <button type="button" disabled={isCompleting} onClick={() => onChangeQuantity(item.productId, -1)} className="grid size-8 place-items-center text-white/72 transition hover:text-white disabled:opacity-35" aria-label={`Decrease ${item.name}`}>
                              <Minus size={14} />
                            </button>
                            <span className="min-w-8 text-center text-sm font-black">{item.quantity}</span>
                            <button type="button" disabled={isCompleting} onClick={() => onChangeQuantity(item.productId, 1)} className="grid size-8 place-items-center text-white/72 transition hover:text-white disabled:opacity-35" aria-label={`Increase ${item.name}`}>
                              <Plus size={14} />
                            </button>
                          </div>
                          <p className="text-sm font-black"><Money value={item.unitPrice * item.quantity} /></p>
                          <button type="button" disabled={isCompleting} onClick={() => onRemoveItem(item.productId)} className="grid size-8 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/62 transition hover:border-red-300/50 hover:text-red-100 disabled:opacity-35" aria-label={`Remove ${item.name}`}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {cart.length > 0 ? (
                  <button type="button" disabled={isCompleting} onClick={onClearCart} className="mt-2 inline-flex h-8 items-center gap-2 rounded-md border border-red-400/70 bg-[#1f0808] px-3 text-xs font-black text-red-100 transition hover:border-red-200 disabled:opacity-40">
                    <Trash2 size={15} />
                    Clear All Items
                  </button>
                ) : null}
              </div>

              <aside className="flex flex-col justify-between rounded-lg border border-white/10 bg-[#03100c] p-3">
                <div className="space-y-2 text-sm">
                  <p className="flex items-center justify-between gap-4">
                    <span className="text-white/66">Items</span>
                    <span className="font-black text-white">{cartCount}</span>
                  </p>
                  <p className="flex items-center justify-between gap-4">
                    <span className="text-white/66">Subtotal</span>
                    <span className="font-black text-white"><Money value={total} /></span>
                  </p>
                  <p className="flex items-center justify-between gap-4">
                    <span className="text-white/66">Tax (incl.)</span>
                    <span className="font-black text-white"><Money value={VAT_INCLUDED} /></span>
                  </p>
                </div>
                <div className="mt-3 border-t border-[#0f3c30] pt-3">
                  <p className="text-base font-black">Total</p>
                  <p className="mt-1 text-2xl font-black text-[#1ce6a3]">{totalLabel}</p>
                </div>
              </aside>
            </section>

            <div className="grid gap-2 lg:grid-cols-[1.05fr_1.05fr_0.95fr]">
              <fieldset disabled={isCompleting} className="rounded-lg border border-[#0b7b58]/70 bg-[#03100c] p-3">
                <legend className="px-2 text-sm font-black">
                  <span className="inline-flex items-center gap-2">
                    <CheckoutStepBadge step={3} />
                    Payment Method
                  </span>
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "cash", label: "Cash", Icon: Banknote },
                    { value: "card", label: "Card", Icon: CreditCard },
                    { value: "split", label: "Split", Icon: Split }
                  ] as const).map(({ value, label, Icon }) => (
                    <label key={value} className={`grid min-h-12 cursor-pointer place-items-center gap-1 rounded-md border px-2 py-1 text-center text-xs font-black transition ${method === value ? "border-[#1ce6a3] bg-[#0b372a] text-white shadow-[0_0_18px_rgba(28,230,163,0.18)]" : "border-white/10 bg-[#071711] text-white/68 hover:border-white/30 hover:text-white"}`}>
                      <input type="radio" name="payment-method" value={value} checked={method === value} onChange={() => setMethod(value)} className="sr-only" />
                      <Icon size={20} aria-hidden="true" />
                      {label}
                    </label>
                  ))}
                </div>

                {method === "split" ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Field label="Cash amount">
                      <input type="number" inputMode="decimal" min="0" max={total} step="0.01" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-white/12 bg-[#06130f] px-3 text-sm font-bold outline-none focus:border-[#1ce6a3]/80" />
                    </Field>
                    <Field label="Card amount">
                      <input type="number" inputMode="decimal" min="0" max={total} step="0.01" value={cardAmount} onChange={(event) => setCardAmount(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-white/12 bg-[#06130f] px-3 text-sm font-bold outline-none focus:border-[#1ce6a3]/80" />
                    </Field>
                  </div>
                ) : null}
                {validationMessage ? <p role="status" className="mt-3 text-xs font-bold text-amber-100">{validationMessage}</p> : null}
              </fieldset>

              <section className="rounded-lg border border-[#0b7b58]/70 bg-[#03100c] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black">Card Payment</h3>
                  <CreditCard size={19} className="text-white/72" />
                </div>
                <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2">
                  <div className="grid h-16 place-items-center rounded-md border border-white/12 bg-[#06130f] text-white/68">
                    <CreditCard size={26} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-white/58">{method === "card" || method === "split" ? "Terminal authorization pending" : "Select Card or Split"}</p>
                    <button type="button" disabled className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[#1ce6a3]/70 bg-[#06251c] px-3 text-xs font-black text-[#8af4c6] disabled:opacity-75">
                      <Wifi size={16} />
                      Send to Card Terminal
                    </button>
                    <p className="mt-2 flex items-center gap-2 text-[11px] font-bold text-[#63efbd]"><span className="size-2 rounded-full bg-[#1ce6a3]" /> Terminal API not connected</p>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-[#0b7b58]/70 bg-[#03100c] p-3">
                <button
                  type="button"
                  disabled={completionDisabled}
                  aria-label={selectedCustomer ? `Complete sale for ${selectedCustomer.fullName}` : "Complete sale"}
                  onClick={() => { if (payment && !validationMessage) onCompleteSale(payment); }}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-[#64f4bf] bg-[#1ce6a3] px-4 py-3 text-sm font-black text-[#02110c] shadow-[0_0_24px_rgba(28,230,163,0.22)] transition hover:bg-[#56f2bd] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/12 disabled:text-white/35 disabled:shadow-none"
                >
                  {isCompleting ? <Loader2 size={18} className="animate-spin" /> : <LockKeyhole size={18} />}
                  {isCompleting ? "Completing Sale..." : "Complete Sale"}
                </button>
                <button type="button" onClick={onClose} className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-white/14 bg-[#06130f] px-4 text-sm font-black text-white/72 transition hover:border-white/35 hover:text-white">
                  Back to POS
                </button>
                {checkoutError ? <p role="alert" className="mt-3 rounded-md border border-amber-200/25 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100">{checkoutError}</p> : null}
                {!checkoutError && selectedCustomer && method ? (
                  <p className="mt-3 flex items-center gap-2 text-xs font-bold text-white/52">
                    <Check size={15} className="text-[#1ce6a3]" />
                    Ready for final validation
                  </p>
                ) : null}
              </section>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
