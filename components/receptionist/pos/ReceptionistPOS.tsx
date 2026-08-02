"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingCart, X } from "lucide-react";
import { checkoutReceptionistSaleAction } from "@/app/dashboard/receptionist/actions";
import { DashboardAccountPanel } from "@/components/account/DashboardAccountMenu";
import { Money } from "@/components/GreenChoiceDashboard";
import { isProductCategory, PRODUCT_SUBCATEGORIES } from "@/lib/manager/options";
import type { ReceptionistCategory, ReceptionistProduct } from "@/lib/receptionist/products";
import { CartPanel } from "@/components/receptionist/pos/CartPanel";
import { FilterPanel } from "@/components/receptionist/pos/FilterPanel";
import { FooterTimestamp } from "@/components/receptionist/pos/FooterTimestamp";
import { ProductDescriptionModal } from "@/components/receptionist/pos/ProductDescriptionModal";
import { ProductGrid } from "@/components/receptionist/pos/ProductGrid";
import { getPOSProductCartDetails } from "@/components/receptionist/pos/product-display";
import type { CartItem, POSMessage, ReceptionistPOSProps, SubcategoryOption } from "@/components/receptionist/pos/pos-types";
import { allowedCategorySlugs, canAddProduct, categoryUsesSecondaryFilter, cultivationKey, displaySubcategory, getCultivationOptions, normalize, preferredSubcategoryOrder, resolveProductSelection, subcategoryKey } from "@/components/receptionist/pos/pos-helpers";

const POS_SELECTION_STORAGE_KEY = "greenchoice:receptionist-pos-selection";
const ADD_TO_CART_FEEDBACK_MS = 3200;
const ADD_TO_CART_DUPLICATE_GUARD_MS = 450;
const SALE_COMPLETE_FEEDBACK_MS = 30_000;

type POSNotice = {
  id: number;
  tone: "success" | "error";
  text: string;
  dismissible?: boolean;
  durationMs: number;
};

function storedSelection() {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(POS_SELECTION_STORAGE_KEY) ?? "null") as { category?: string; subcategory?: string; cultivationType?: string } | null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function EmptyState({ title, body, detail }: { title: string; body: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/14 bg-white/[0.04] p-8 text-center">
      <p className="text-2xl font-extrabold">{title}</p>
      <p className="mt-2 text-white/62">{body}</p>
      {detail ? <p className="mx-auto mt-4 max-w-2xl rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/45">{detail}</p> : null}
    </div>
  );
}

function FloatingCheckoutButton({
  visible,
  cartCount,
  onClick
}: {
  visible: boolean;
  cartCount: number;
  onClick: () => void;
}) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-[calc(env(safe-area-inset-right)+1rem)] z-50 grid size-16 touch-manipulation place-items-center rounded-full border border-emerald-300/60 bg-[#04100a]/95 text-emerald-100 shadow-[0_16px_38px_rgba(0,0,0,0.48),0_0_26px_rgba(16,185,129,0.26),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:border-emerald-100 hover:bg-[#082016] hover:text-white active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-100 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020503] motion-reduce:transition-none sm:bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:right-[calc(env(safe-area-inset-right)+1.25rem)] sm:size-[4.5rem]"
      aria-label="Go to checkout"
    >
      <ShoppingCart size={28} strokeWidth={2.35} aria-hidden="true" />
      {cartCount > 0 ? (
        <span className="absolute -right-1 -top-1 grid min-w-6 place-items-center rounded-full border border-[#04100a] bg-emerald-400 px-1.5 text-xs font-black leading-6 text-[#031008]">
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      ) : null}
    </button>
  );
}

function POSNotification({ notice, onDismiss }: { notice: POSNotice | null; onDismiss: () => void }) {
  if (!notice) return null;

  const success = notice.tone === "success";
  return (
    <div className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[60] flex justify-center sm:top-[calc(env(safe-area-inset-top)+1rem)]">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold shadow-[0_16px_40px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.1)] ${success ? "border-emerald-200/55 bg-[#082116]/96 text-emerald-100" : "border-red-200/55 bg-[#250b0b]/96 text-red-100"}`}
      >
        <span className={`size-2.5 shrink-0 rounded-full ${success ? "bg-lime-300" : "bg-red-300"}`} />
        <span className="min-w-0 flex-1">{notice.text}</span>
        {notice.dismissible ? (
          <button type="button" onClick={onDismiss} className="grid size-8 shrink-0 place-items-center rounded-full border border-white/15 text-white/82 transition hover:border-white/40 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-100 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020503]" aria-label="Close message">
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function getSubcategoryOptions(products: ReceptionistProduct[], selectedCategory: ReceptionistCategory | null): SubcategoryOption[] {
  if (!selectedCategory) return [];

  const optionMap = new Map<string, SubcategoryOption>();
  products.forEach((product) => {
    const matchesSelectedCategory =
      product.categorySlug === selectedCategory.slug || normalize(product.categoryName) === normalize(selectedCategory.name);

    if (!matchesSelectedCategory || !product.subcategory) return;

    const key = subcategoryKey(product.subcategory);
    const existing = optionMap.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }

    optionMap.set(key, {
      label: displaySubcategory(product.subcategory),
      value: product.subcategory,
      count: 1
    });
  });

  const allowedSubcategories = isProductCategory(selectedCategory.name) ? PRODUCT_SUBCATEGORIES[selectedCategory.name] : null;
  const preferredOrder = allowedSubcategories ? [...allowedSubcategories] : preferredSubcategoryOrder[selectedCategory.slug] ?? [];
  const options = Array.from(optionMap.values()).filter((item) => !allowedSubcategories || allowedSubcategories.includes(item.value as never));

  return options.sort((a, b) => {
    const aIndex = preferredOrder.findIndex((item) => subcategoryKey(item) === subcategoryKey(a.value));
    const bIndex = preferredOrder.findIndex((item) => subcategoryKey(item) === subcategoryKey(b.value));
    if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
    return a.label.localeCompare(b.label);
  });
}

function getFilteredProducts({
  products,
  selectedCategory,
  subcategory,
  showCultivationFilter,
  cultivationType
}: {
  products: ReceptionistProduct[];
  selectedCategory: ReceptionistCategory | null;
  subcategory: string;
  showCultivationFilter: boolean;
  cultivationType: string;
}) {
  if (!selectedCategory || !subcategory || (showCultivationFilter && !cultivationType)) return [];

  const selectedSubcategory = subcategoryKey(subcategory);
  return products.filter((product) => {
    const matchesCategory = product.categorySlug === selectedCategory.slug || normalize(product.categoryName) === normalize(selectedCategory.name);
    const matchesCultivation = !showCultivationFilter || cultivationKey(product.cultivationType) === cultivationKey(cultivationType);
    const matchesSubcategory = subcategoryKey(product.subcategory) === selectedSubcategory;
    return matchesCategory && matchesCultivation && matchesSubcategory;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function ReceptionistPOS({
  products,
  categories,
  unavailableReason,
  initialCategory,
  isDemo = false,
  storeName = "DISPENSARY",
  backToDashboardHref,
  checkoutAction,
  accountProfile,
  accountRole = "receptionist"
}: ReceptionistPOSProps) {
  const initialStoredSelection = initialCategory ? null : storedSelection();
  const [category, setCategory] = useState(initialCategory ?? initialStoredSelection?.category ?? "");
  const [cultivationType, setCultivationType] = useState(initialStoredSelection?.cultivationType ?? "");
  const [subcategory, setSubcategory] = useState(initialStoredSelection?.subcategory ?? "");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [message, setMessage] = useState<POSMessage | null>(null);
  const [notice, setNotice] = useState<POSNotice | null>(null);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState(() => crypto.randomUUID());
  const [isPending, startTransition] = useTransition();
  const contentGridRef = useRef<HTMLDivElement>(null);
  const strainPanelRef = useRef<HTMLDivElement>(null);
  const productResultsRef = useRef<HTMLDivElement>(null);
  const checkoutSectionRef = useRef<HTMLDivElement>(null);
  const [cartOffset, setCartOffset] = useState(0);
  const [checkoutShortcutVisible, setCheckoutShortcutVisible] = useState(false);
  const recentAddClicksRef = useRef(new Map<string, number>());
  const noticeIdRef = useRef(0);

  const selectedProduct = useMemo(() => products.find((product) => product.id === selectedProductId) ?? null, [products, selectedProductId]);
  const visibleCategories = useMemo(() => categories.filter((item) => allowedCategorySlugs.has(item.slug)), [categories]);
  const resolvedSelection = useMemo(() => resolveProductSelection({
    products,
    categories: visibleCategories,
    current: { category, subcategory, cultivationType }
  }), [category, cultivationType, products, subcategory, visibleCategories]);
  const effectiveCategory = resolvedSelection?.category ?? category;
  const effectiveSubcategory = resolvedSelection?.subcategory ?? subcategory;
  const effectiveCultivationType = resolvedSelection?.cultivationType ?? cultivationType;

  const selectedCategory = useMemo(() => {
    if (!effectiveCategory) return null;
    return visibleCategories.find((item) => item.slug === effectiveCategory || normalize(item.name) === normalize(effectiveCategory)) ?? null;
  }, [effectiveCategory, visibleCategories]);
  const showCultivationFilter = categoryUsesSecondaryFilter(selectedCategory);
  const hasRequiredFilters = Boolean(selectedCategory && effectiveSubcategory && (!showCultivationFilter || effectiveCultivationType));

  const subcategoryOptions = useMemo(() => getSubcategoryOptions(products, selectedCategory), [products, selectedCategory]);
  const cultivationOptions = useMemo(() => getCultivationOptions(products, selectedCategory, effectiveSubcategory), [effectiveSubcategory, products, selectedCategory]);
  const filteredProducts = useMemo(() => getFilteredProducts({ products, selectedCategory, subcategory: effectiveSubcategory, showCultivationFilter, cultivationType: effectiveCultivationType }), [effectiveCultivationType, effectiveSubcategory, products, selectedCategory, showCultivationFilter]);

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartPanelStyle = { "--pos-cart-offset": `${cartOffset}px` } as CSSProperties;

  useEffect(() => {
    function updateCartOffset() {
      const contentGrid = contentGridRef.current;
      const productResults = productResultsRef.current;
      if (!contentGrid || !productResults || window.innerWidth < 1280) {
        setCartOffset(0);
        return;
      }

      const nextOffset = Math.max(0, productResults.getBoundingClientRect().top - contentGrid.getBoundingClientRect().top);
      setCartOffset(Math.round(nextOffset));
    }

    updateCartOffset();
    window.addEventListener("resize", updateCartOffset);
    return () => window.removeEventListener("resize", updateCartOffset);
  }, [category, cultivationOptions.length, message, showCultivationFilter, subcategory, subcategoryOptions.length]);

  useEffect(() => {
    if (!notice) return;
    const timeoutId = globalThis.setTimeout(() => {
      setNotice((current) => (current?.id === notice.id ? null : current));
    }, notice.durationMs);
    return () => globalThis.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (!addedProductId) return;
    const timeoutId = globalThis.setTimeout(() => {
      setAddedProductId((current) => (current === addedProductId ? null : current));
    }, 650);
    return () => globalThis.clearTimeout(timeoutId);
  }, [addedProductId]);

  useEffect(() => {
    const checkoutSection = checkoutSectionRef.current;
    if (!checkoutSection) return;

    if (!("IntersectionObserver" in window)) {
      const fallbackTimer = globalThis.setTimeout(() => setCheckoutShortcutVisible(true), 0);
      return () => globalThis.clearTimeout(fallbackTimer);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const nextVisible = !entry.isIntersecting;
        setCheckoutShortcutVisible((current) => (current === nextVisible ? current : nextVisible));
      },
      {
        threshold: 0.16,
        rootMargin: "-10% 0px -16% 0px"
      }
    );

    observer.observe(checkoutSection);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || filteredProducts.length === 0 || !hasRequiredFilters) return;
    window.sessionStorage.setItem(POS_SELECTION_STORAGE_KEY, JSON.stringify({ category: effectiveCategory, subcategory: effectiveSubcategory, cultivationType: effectiveCultivationType }));
  }, [effectiveCategory, effectiveCultivationType, effectiveSubcategory, filteredProducts.length, hasRequiredFilters]);

  const selectCategory = useCallback((nextCategory: string) => {
    setCategory(nextCategory);
    setSubcategory("");
    setCultivationType("");
    if (!nextCategory) {
      return;
    }

    const nextCategoryRecord = visibleCategories.find((item) => item.slug === nextCategory || normalize(item.name) === normalize(nextCategory));
    if (!nextCategoryRecord || !categoryUsesSecondaryFilter(nextCategoryRecord)) {
      setCultivationType("");
    }
  }, [visibleCategories]);

  const selectSubcategory = useCallback((nextSubcategory: string) => {
    setCategory(effectiveCategory);
    setSubcategory(nextSubcategory);
    setCultivationType("");
  }, [effectiveCategory]);

  const selectCultivationType = useCallback((nextCultivationType: string) => {
    setCategory(effectiveCategory);
    setSubcategory(effectiveSubcategory);
    setCultivationType(nextCultivationType);
  }, [effectiveCategory, effectiveSubcategory]);

  const addToCart = useCallback((product: ReceptionistProduct) => {
    setMessage(null);
    if (!canAddProduct(product)) {
      setMessage({ tone: "error", text: "This product cannot be added because it is unavailable, out of stock, or has an invalid price." });
      return;
    }

    const now = Date.now();
    const recentAddAt = recentAddClicksRef.current.get(product.id) ?? 0;
    if (now - recentAddAt < ADD_TO_CART_DUPLICATE_GUARD_MS) return;
    recentAddClicksRef.current.set(product.id, now);

    const existingCartItem = cart.find((item) => item.productId === product.id);
    if (existingCartItem && existingCartItem.quantity >= product.quantityAvailable) {
      setMessage({ tone: "error", text: "Not enough stock available for this product." });
      return;
    }

    setCart((current) => {
      const details = getPOSProductCartDetails(product);
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.quantityAvailable) {
          setMessage({ tone: "error", text: "Not enough stock available for this product." });
          return current;
        }
        return current.map((item) => (item.productId === product.id ? { ...item, ...details, quantity: item.quantity + 1 } : item));
      }

      return [
        ...current,
        {
          productId: product.id,
          ...details,
          quantity: 1,
        }
      ];
    });

    setAddedProductId(product.id);
    setNotice({ id: ++noticeIdRef.current, tone: "success", text: "Product added to cart", durationMs: ADD_TO_CART_FEEDBACK_MS });
  }, [cart]);

  const changeQuantity = useCallback((productId: string, delta: number) => {
    setMessage(null);
    setCart((current) =>
      current.flatMap((item) => {
        if (item.productId !== productId) return item;
        const nextQuantity = item.quantity + delta;
        if (nextQuantity <= 0) return [];
        if (nextQuantity > item.stockAvailable) {
          setMessage({ tone: "error", text: "Quantity cannot exceed available stock." });
          return item;
        }
        return { ...item, quantity: nextQuantity };
      })
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setMessage(null);
    setCart((current) => current.filter((item) => item.productId !== productId));
  }, []);

  const cancelSale = useCallback(() => {
    setCart([]);
    setSelectedProductId(null);
    setCheckoutId(crypto.randomUUID());
    setMessage(null);
  }, []);

  const checkout = useCallback(() => {
    if (isPending) return;
    if (cart.length === 0) {
      setMessage({ tone: "error", text: "Cart is empty." });
      return;
    }

    const invalidItem = cart.find((item) => !item.productId || item.quantity <= 0 || item.quantity > item.stockAvailable || !Number.isFinite(item.unitPrice) || item.unitPrice < 0);
    if (invalidItem) {
      setMessage({ tone: "error", text: "Please review the cart before checkout." });
      return;
    }

    if (isDemo && !checkoutAction) {
      setCart([]);
      setSelectedProductId(null);
      setCheckoutId(crypto.randomUUID());
      setNotice({ id: ++noticeIdRef.current, tone: "success", text: "Sale completed", dismissible: true, durationMs: SALE_COMPLETE_FEEDBACK_MS });
      return;
    }

    startTransition(async () => {
      const completeSale = checkoutAction ?? checkoutReceptionistSaleAction;
      const result = await completeSale({
        checkoutId,
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice }))
      });

      if (!result.ok) {
        setMessage({ tone: "error", text: result.message });
        return;
      }

      setCart([]);
      setSelectedProductId(null);
      setCheckoutId(crypto.randomUUID());
      setNotice({ id: ++noticeIdRef.current, tone: "success", text: "Sale completed", dismissible: true, durationMs: SALE_COMPLETE_FEEDBACK_MS });
    });
  }, [cart, checkoutAction, checkoutId, isDemo, isPending, startTransition]);

  const dismissNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const goToCheckoutSection = useCallback(() => {
    const checkoutSection = checkoutSectionRef.current;
    if (!checkoutSection) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    checkoutSection.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "nearest"
    });
    checkoutSection.focus({ preventScroll: true });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-[1920px] flex-col px-4 py-3 text-white sm:px-6">
      <header className="grid gap-0 border-b border-white/10 pb-1 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="flex justify-start">
          {backToDashboardHref ? (
            <Link href={backToDashboardHref} className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-[#050b08] px-4 text-sm font-bold text-white shadow-[0_0_20px_rgba(34,197,94,0.14),0_10px_28px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-emerald-300/75 hover:bg-[#07130d] hover:text-lime-200 hover:shadow-[0_0_26px_rgba(34,197,94,0.25),0_10px_28px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.07)] focus-visible:ring-2 focus-visible:ring-emerald-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020503]">
              <ArrowLeft size={17} />
              Back to Dashboard
            </Link>
          ) : null}
        </div>
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/branding/greenchoice-logo.png" alt={`${storeName} GreenChoice logo`} className="h-20 w-[min(30cm,calc(100vw-2rem))] object-contain sm:h-24 sm:w-[min(30cm,58vw)] lg:h-28" />
        </div>
        <div className="flex items-center justify-start gap-3 sm:justify-end">
          {cartCount ? <p className="hidden text-sm font-semibold text-white/64 md:block sm:text-right">{`${cartCount} item${cartCount === 1 ? "" : "s"} in cart`}</p> : null}
          {accountProfile ? <DashboardAccountPanel role={accountRole} profile={accountProfile} /> : null}
        </div>
      </header>

      <div ref={contentGridRef} className="grid flex-1 gap-5 py-3 xl:grid-cols-[minmax(0,936px)_minmax(400px,460px)] xl:justify-between">
        <section className="min-w-0">
          <FilterPanel
            message={message}
            visibleCategories={visibleCategories}
            category={effectiveCategory}
            showCultivationFilter={showCultivationFilter}
            cultivationType={effectiveCultivationType}
            subcategory={effectiveSubcategory}
            subcategoryOptions={selectedCategory ? subcategoryOptions : []}
            cultivationOptions={cultivationOptions}
            strainPanelRef={strainPanelRef}
            visualStyle="receptionist"
            onSelectCategory={selectCategory}
            onSelectCultivationType={selectCultivationType}
            onSelectSubcategory={selectSubcategory}
          />

          <div ref={productResultsRef}>
            {unavailableReason ? (
              <EmptyState title="Products unavailable" body="Products unavailable. Please try again or contact the manager." detail={unavailableReason} />
            ) : products.length === 0 ? (
              <EmptyState title="No products available yet." body="Products added by the manager will appear here." />
            ) : !hasRequiredFilters ? (
              <EmptyState title="Select a category and filters to view products." body="Choose a category, then select the required filter buttons." />
            ) : filteredProducts.length === 0 ? (
              <EmptyState title="No matching products found." body="Try a different category or filter combination." />
            ) : (
              <ProductGrid products={filteredProducts} onAddToCart={addToCart} onOpenDescription={setSelectedProductId} addedProductId={addedProductId} />
            )}
          </div>
        </section>

        <div
          id="current-sale"
          ref={checkoutSectionRef}
          tabIndex={-1}
          aria-label="Current Sale checkout section"
          className="scroll-mt-4 self-start outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020503] xl:pt-[var(--pos-cart-offset)]"
          style={cartPanelStyle}
        >
          <CartPanel
            cart={cart}
            subtotal={subtotal}
            cartCount={cartCount}
            isPending={isPending}
            onClearCart={cancelSale}
            onChangeQuantity={changeQuantity}
            onRemoveItem={removeItem}
            onCheckout={checkout}
          />
        </div>
      </div>

      <footer className="flex flex-col gap-3 border-t border-white/10 py-4 text-sm text-white/68 sm:flex-row sm:items-center sm:justify-between">
        <p><span className="mr-2 inline-block size-3 rounded-full bg-emerald-500" /> Online <span className="mx-4 text-white/20">|</span> Cash Drawer #1 <span className="mx-4 text-white/20">|</span> Till: <Money value={subtotal} /></p>
        <FooterTimestamp />
      </footer>

      <ProductDescriptionModal product={selectedProduct} onClose={() => setSelectedProductId(null)} />
      <FloatingCheckoutButton visible={checkoutShortcutVisible} cartCount={cartCount} onClick={goToCheckoutSection} />
      <POSNotification notice={notice} onDismiss={dismissNotice} />
    </main>
  );
}
