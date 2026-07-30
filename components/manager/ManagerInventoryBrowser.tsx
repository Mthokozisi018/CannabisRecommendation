"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Eye, EyeOff, ImagePlus, Info, PackageSearch, Save, SquarePen, Trash2, Upload, X } from "lucide-react";
import { archiveProductAction, updateProductCardAction, updateProductPosVisibilityAction } from "@/app/dashboard/manager/actions";
import { Money } from "@/components/GreenChoiceDashboard";
import { Field, formatStockQuantity, initialState, ManualNumberInput, Message, PendingNotice, PendingSpinner, type ManagerFormAction } from "@/components/manager/forms/shared";
import { FilterPanel } from "@/components/receptionist/pos/FilterPanel";
import { categoryUsesSecondaryFilter, cultivationKey, displaySubcategory, getCultivationOptions, normalize, resolveProductSelection, stockLabel, stockQuantityLabel, subcategoryKey } from "@/components/receptionist/pos/pos-helpers";
import { categoryAllowsCultivationType, categoryButtonOrder, categorySlug, CULTIVATION_TYPES, isProductCategory, PRODUCT_SUBCATEGORIES } from "@/lib/manager/options";
import { getPreRollCultivationCardImage, getProductImage } from "@/lib/product-images";
import type { ManagerInventoryProduct } from "@/lib/manager/data";
import type { ReceptionistCategory, ReceptionistProduct } from "@/lib/receptionist/products";
import type { POSMessage, SubcategoryOption } from "@/components/receptionist/pos/pos-types";

type BrowserProduct = ReceptionistProduct & {
  managerProduct: ManagerInventoryProduct;
};

function packageCount(product: ManagerInventoryProduct) {
  const value = product.facet_values?.packageCount;
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function toBrowserProduct(product: ManagerInventoryProduct): BrowserProduct {
  const categoryName = product.category || "Uncategorized";
  const stock = product.inventory_stock;

  return {
    id: product.id,
    name: product.product_name || "Unnamed product",
    categoryName,
    categorySlug: categorySlug(categoryName),
    subcategory: product.subcategory || "General",
    cultivationType: product.cultivation_type,
    description: product.description || "",
    thcPerUnitMg: product.thc_per_unit_mg,
    thcPerPacketMg: product.thc_per_packet_mg,
    imageUrl: product.image_url,
    imagePath: product.image_path,
    sizeLabel: null,
    strainType: product.subcategory,
    sellingPrice: Number(product.price ?? 0),
    productStatus: product.product_status || "inactive",
    isVisibleOnPos: product.is_visible_on_pos !== false,
    isActive: product.product_status === "active",
    isNew: product.created_at ? Date.now() - new Date(product.created_at).getTime() < 1000 * 60 * 60 * 24 * 30 : false,
    quantityAvailable: Number(stock?.current_quantity ?? 0),
    lowStockThreshold: Number(stock?.low_stock_threshold ?? 0),
    managerProduct: product
  };
}

function deriveCategories(products: BrowserProduct[]) {
  const categoryMap = new Map<string, ReceptionistCategory>();
  products.forEach((product) => {
    const existing = categoryMap.get(product.categorySlug);
    if (existing) {
      existing.count += 1;
      return;
    }
    categoryMap.set(product.categorySlug, { name: product.categoryName, slug: product.categorySlug, count: 1 });
  });
  return Array.from(categoryMap.values()).sort((a, b) => categoryButtonOrder(a.name) - categoryButtonOrder(b.name) || a.name.localeCompare(b.name));
}

function subcategoryOptions(products: BrowserProduct[], selectedCategory: ReceptionistCategory | null): SubcategoryOption[] {
  if (!selectedCategory) return [];
  const optionMap = new Map<string, SubcategoryOption>();

  products.forEach((product) => {
    const matchesCategory = product.categorySlug === selectedCategory.slug || normalize(product.categoryName) === normalize(selectedCategory.name);
    if (!matchesCategory || !product.subcategory) return;

    const key = subcategoryKey(product.subcategory);
    const existing = optionMap.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    optionMap.set(key, { label: displaySubcategory(product.subcategory), value: product.subcategory, count: 1 });
  });

  const allowedSubcategories = isProductCategory(selectedCategory.name) ? PRODUCT_SUBCATEGORIES[selectedCategory.name] : null;
  const options = Array.from(optionMap.values()).filter((item) => !allowedSubcategories || allowedSubcategories.includes(item.value as never));
  const preferredOrder = allowedSubcategories ? [...allowedSubcategories] : [];

  return options.sort((a, b) => {
    const aIndex = preferredOrder.findIndex((item) => subcategoryKey(item) === subcategoryKey(a.value));
    const bIndex = preferredOrder.findIndex((item) => subcategoryKey(item) === subcategoryKey(b.value));
    if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
    return a.label.localeCompare(b.label);
  });
}

function filteredProducts(input: {
  products: BrowserProduct[];
  selectedCategory: ReceptionistCategory | null;
  subcategory: string;
  showCultivationFilter: boolean;
  cultivationType: string;
}) {
  const { products, selectedCategory, subcategory, showCultivationFilter, cultivationType } = input;
  if (!selectedCategory || !subcategory || (showCultivationFilter && !cultivationType)) return [];
  const selectedSubcategory = subcategoryKey(subcategory);

  return products.filter((product) => {
    const matchesCategory = product.categorySlug === selectedCategory.slug || normalize(product.categoryName) === normalize(selectedCategory.name);
    const matchesCultivation = !showCultivationFilter || cultivationKey(product.cultivationType) === cultivationKey(cultivationType);
    return matchesCategory && matchesCultivation && subcategoryKey(product.subcategory) === selectedSubcategory;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/14 bg-white/[0.04] p-8 text-center">
      <p className="text-2xl font-extrabold">{title}</p>
      <p className="mt-2 text-white/62">{body}</p>
    </div>
  );
}

const allowedProductImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxProductImageBytes = 6 * 1024 * 1024;

function ManagerInventoryCard({
  product,
  onEdit,
  visibilityAction,
  archiveAction,
  onProductArchived,
  onVisibilityChanged
}: {
  product: BrowserProduct;
  onEdit: (productId: string) => void;
  visibilityAction: ManagerFormAction;
  archiveAction: ManagerFormAction;
  onProductArchived: (productId: string, message: string) => void;
  onVisibilityChanged: (productId: string, isVisibleOnPos: boolean, message: string) => void;
}) {
  const preRollCultivationImage = getPreRollCultivationCardImage(product);
  const productImage = preRollCultivationImage ?? getProductImage(product);
  const [state, formAction, pending] = useActionState(visibilityAction, initialState);
  const [archiveState, archiveFormAction, archivePending] = useActionState(archiveAction, initialState);
  const [confirming, setConfirming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const handledStateRef = useRef<typeof state | null>(null);
  const handledArchiveStateRef = useRef<typeof archiveState | null>(null);
  const isVisibleOnPos = product.managerProduct.is_visible_on_pos !== false;
  const nextVisible = !isVisibleOnPos;
  const confirmTitle = isVisibleOnPos ? "Remove from POS" : "Put Back on POS";
  const confirmBody = isVisibleOnPos ? "This product will be hidden from the receptionist POS. It will not be deleted." : "This product will be shown on the receptionist POS again.";

  useEffect(() => {
    if (!state.ok || state.productId !== product.id || typeof state.isVisibleOnPos !== "boolean") return;
    if (handledStateRef.current === state) return;
    handledStateRef.current = state;
    setConfirming(false);
    onVisibilityChanged(product.id, state.isVisibleOnPos, state.message);
  }, [onVisibilityChanged, product.id, state]);

  useEffect(() => {
    if (!archiveState.ok || archiveState.productId !== product.id) return;
    if (handledArchiveStateRef.current === archiveState) return;
    handledArchiveStateRef.current = archiveState;
    setConfirmingDelete(false);
    onProductArchived(product.id, archiveState.message);
  }, [archiveState, onProductArchived, product.id]);

  return (
    <article className="group flex w-full max-w-[230px] flex-col rounded-xl border border-white/12 bg-[linear-gradient(145deg,rgba(12,45,31,0.72),rgba(5,12,10,0.88))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <button type="button" onClick={() => onEdit(product.id)} className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-black/20 text-left" aria-label={`Edit ${product.name}`}>
        {/* Product images can be Supabase URLs or local placeholders. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={productImage} alt={`${product.name} product image`} className={`absolute inset-0 size-full drop-shadow-[0_10px_18px_rgba(0,0,0,0.5)] transition group-hover:scale-105 ${preRollCultivationImage ? "object-cover" : "object-contain p-1.5"}`} />
        <span className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full border border-white/70 bg-black/35 text-white">
          <SquarePen size={15} />
        </span>
        <span className="absolute bottom-1.5 left-1.5 rounded-md bg-emerald-500/75 px-2 py-0.5 text-[0.68rem] font-bold leading-5">{product.categoryName}</span>
        {!isVisibleOnPos ? <span className="absolute bottom-1.5 right-1.5 rounded-md border border-amber-200/35 bg-amber-500/20 px-2 py-0.5 text-[0.62rem] font-extrabold leading-5 text-amber-100">Hidden from POS</span> : null}
      </button>
      <div className="mt-3 min-h-[88px]">
        <p className="line-clamp-2 text-[0.95rem] font-extrabold leading-tight">{product.name}</p>
        <p className="mt-1 line-clamp-1 min-h-4 text-xs text-white/68">{[displaySubcategory(product.subcategory), product.cultivationType].filter(Boolean).join(" / ")}</p>
        <p className="mt-3 text-lg font-extrabold text-emerald-400"><Money value={product.sellingPrice} /></p>
        {!isVisibleOnPos ? <p className="mt-1 text-[0.7rem] font-bold text-amber-100">Hidden from POS</p> : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-white/80">
        <span>{stockLabel(product.quantityAvailable)}</span>
        <span>{stockQuantityLabel(product)}</span>
      </div>
      <button type="button" onClick={() => onEdit(product.id)} className="mt-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-400">
        Edit Product
      </button>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`mt-2 inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition ${
          isVisibleOnPos
            ? "border-amber-200/30 bg-amber-500/12 text-amber-100 hover:border-amber-200/55"
            : "border-emerald-300/35 bg-emerald-500/15 text-emerald-100 hover:border-emerald-300/65"
        }`}
      >
        {isVisibleOnPos ? <EyeOff size={15} /> : <Eye size={15} />}
        {isVisibleOnPos ? "Remove from POS" : "Put Back on POS"}
      </button>
      {!state.ok && state.message ? <p className="mt-2 rounded-lg border border-red-300/25 bg-red-500/10 px-2 py-1.5 text-[0.7rem] font-semibold text-red-100">{state.message}</p> : null}
      <button type="button" onClick={() => setConfirmingDelete(true)} className="mt-2 inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-red-300/35 bg-red-500/15 px-3 py-2 text-xs font-bold text-red-100 transition hover:border-red-200/65">
        <Trash2 size={15} />
        Delete Product
      </button>
      {!archiveState.ok && archiveState.message ? <p className="mt-2 rounded-lg border border-red-300/25 bg-red-500/10 px-2 py-1.5 text-[0.7rem] font-semibold text-red-100">{archiveState.message}</p> : null}
      {confirming ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={`pos-visibility-title-${product.id}`}>
          <form action={formAction} className="w-full max-w-sm rounded-[8px] border border-white/15 bg-[#07100d] p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,0.6)]">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="isVisibleOnPos" value={String(nextVisible)} />
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lime-400/15 text-lime-300">
                <AlertTriangle size={20} />
              </span>
              <div>
                <h2 id={`pos-visibility-title-${product.id}`} className="text-lg font-extrabold">{confirmTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-white/70">{confirmBody}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirming(false)} className="h-10 rounded-lg border border-white/15 px-4 text-sm font-bold text-white/78 transition hover:border-white/35">Cancel</button>
              <button disabled={pending} aria-busy={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-lime-500 px-4 text-sm font-extrabold text-black transition hover:bg-lime-400 disabled:opacity-55">
                {pending ? <><PendingSpinner /> Updating POS visibility...</> : confirmTitle}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {confirmingDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={`delete-product-title-${product.id}`}>
          <form action={archiveFormAction} className="w-full max-w-sm rounded-[8px] border border-white/15 bg-[#07100d] p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,0.6)]">
            <input type="hidden" name="productId" value={product.id} />
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-200">
                <Trash2 size={20} />
              </span>
              <div>
                <h2 id={`delete-product-title-${product.id}`} className="text-lg font-extrabold">Delete Product</h2>
                <p className="mt-2 text-sm leading-6 text-white/70">This product will be removed from Manage Inventory and hidden from the receptionist POS. Stock history and sales records will remain.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmingDelete(false)} className="h-10 rounded-lg border border-white/15 px-4 text-sm font-bold text-white/78 transition hover:border-white/35">Cancel</button>
              <button disabled={archivePending} aria-busy={archivePending} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 text-sm font-extrabold text-white transition hover:bg-red-400 disabled:opacity-55">
                {archivePending ? <><PendingSpinner /> Deleting product...</> : "Delete Product"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </article>
  );
}

function EditProductModal({
  product,
  action,
  onClose,
  onSaved
}: {
  product: BrowserProduct | null;
  action: ManagerFormAction;
  onClose: () => void;
  onSaved: (product: ManagerInventoryProduct) => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [name, setName] = useState(product?.managerProduct.product_name ?? "");
  const [price, setPrice] = useState(product ? Number(product.managerProduct.price).toFixed(2) : "");
  const [subcategory, setSubcategory] = useState(product?.managerProduct.subcategory ?? "");
  const [cultivationType, setCultivationType] = useState(product?.managerProduct.cultivation_type ?? "");
  const [ediblePackageCount, setEdiblePackageCount] = useState(product ? packageCount(product.managerProduct) : "");
  const [thcPerUnitMg, setThcPerUnitMg] = useState(product?.managerProduct.thc_per_unit_mg?.toString() ?? "");
  const [thcPerPacketMg, setThcPerPacketMg] = useState(product?.managerProduct.thc_per_packet_mg?.toString() ?? "");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const handledStateRef = useRef<typeof state | null>(null);
  const currentImageUrl = removeExistingImage ? null : imagePreviewUrl || product?.managerProduct.image_url || null;

  function clearSelectedPicture({ removeSaved = false }: { removeSaved?: boolean } = {}) {
    setImageError("");
    setImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    setRemoveExistingImage(removeSaved);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function selectProductImage(file: File | null) {
    setImageError("");
    if (!file) {
      clearSelectedPicture();
      return;
    }
    if (!allowedProductImageTypes.has(file.type)) {
      clearSelectedPicture();
      setImageError("Choose a PNG, JPG, JPEG, or WebP image.");
      return;
    }
    if (file.size > maxProductImageBytes) {
      clearSelectedPicture();
      setImageError("Image must be 6MB or smaller.");
      return;
    }
    setImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setRemoveExistingImage(false);
  }

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    if (!state.ok || !product) return;
    if (handledStateRef.current === state) return;
    handledStateRef.current = state;
    const timeoutId = window.setTimeout(() => {
      onSaved({
        ...product.managerProduct,
        product_name: name.trim(),
        subcategory,
        cultivation_type: categoryAllowsCultivationType(product.managerProduct.category) ? cultivationType : null,
        thc_per_unit_mg: product.managerProduct.category === "Edibles" ? Number(thcPerUnitMg) : null,
        thc_per_packet_mg: product.managerProduct.category === "Edibles" ? Number(thcPerPacketMg) : null,
        facet_values: product.managerProduct.category === "Edibles" ? { ...(product.managerProduct.facet_values ?? {}), packageCount: ediblePackageCount } : product.managerProduct.facet_values,
        price: Number(price),
        image_bucket: state.imageBucket !== undefined ? state.imageBucket : product.managerProduct.image_bucket,
        image_path: state.imagePath !== undefined ? state.imagePath : product.managerProduct.image_path,
        image_url: state.imageUrl !== undefined ? state.imageUrl : product.managerProduct.image_url,
        updated_at: new Date().toISOString()
      });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [cultivationType, ediblePackageCount, name, onSaved, price, product, state, state.imageBucket, state.imagePath, state.imageUrl, state.ok, subcategory, thcPerPacketMg, thcPerUnitMg]);

  if (!product) return null;

  const category = product.managerProduct.category;
  const subcategories = isProductCategory(category) ? PRODUCT_SUBCATEGORIES[category] : [product.subcategory];
  const showCultivation = categoryAllowsCultivationType(category);
  const showEdible = category === "Edibles";
  const showStrain = category === "Flower" || category === "Pre-Rolls" || category === "Vape Cartridges" || category === "Disposable Vapes";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="manager-edit-product-title">
      <form action={formAction} encType="multipart/form-data" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[8px] border border-lime-400/25 bg-[#08100d] p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,0.6)]">
        <input type="hidden" name="productId" value={product.id} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="productStatus" value={product.managerProduct.product_status} />
        <input type="hidden" name="removeProductImage" value={removeExistingImage ? "1" : ""} />
        <header className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-300">Inventory Product</p>
            <h2 id="manager-edit-product-title" className="mt-2 text-3xl font-extrabold">Edit Product</h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-white/65"><Info size={16} /> Stock additions stay on the Add Stock screen.</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full border border-white/15 bg-black/25 text-white/80 transition hover:border-lime-300 hover:text-lime-300" aria-label="Close edit product modal">
            <X size={20} />
          </button>
        </header>

        <div className="mt-5 space-y-5">
          <PendingNotice active={pending} text="Saving product..." />
          {!pending ? <Message state={state} /> : null}
          <div className="rounded-xl border border-lime-400/20 bg-lime-400/10 p-4">
            <p className="text-sm font-bold text-lime-200">Current Stock</p>
            <p className="mt-2 text-3xl font-extrabold">{formatStockQuantity(product.managerProduct.inventory_stock?.current_quantity, category)}</p>
          </div>

          <section className="rounded-xl border border-white/12 bg-black/22 p-4">
            <input ref={imageInputRef} name="productImage" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => selectProductImage(event.target.files?.[0] ?? null)} />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/15 bg-white/5">
                {currentImageUrl ? (
                  <>
                    {/* Product images can be Supabase URLs or local blob previews. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={currentImageUrl} alt={`${product.name} product preview`} className="size-full object-cover" />
                  </>
                ) : (
                  <ImagePlus className="text-lime-300" size={30} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">Product Picture <span className="font-semibold text-white/55">(optional)</span></p>
                <p className="mt-1 text-sm text-white/62">Upload a PNG, JPG, JPEG, or WebP image. Leave empty to keep the current image or default placeholder.</p>
                {imageError ? <p className="mt-2 rounded-lg border border-red-300/25 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100">{imageError}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => imageInputRef.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-black/25 px-3 text-xs font-bold text-white transition hover:border-lime-300/70 hover:text-lime-200">
                    <Upload size={15} />
                    {currentImageUrl ? "Change Picture" : "Add Picture"}
                  </button>
                  {currentImageUrl ? (
                    <button type="button" onClick={() => clearSelectedPicture({ removeSaved: !imagePreviewUrl && Boolean(product.managerProduct.image_url) })} className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-300/30 bg-red-500/10 px-3 text-xs font-bold text-red-100 transition hover:border-red-200/70">
                      <Trash2 size={15} />
                      Remove Picture
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <Field label="Product name">
            <input name="productName" value={name} onChange={(event) => setName(event.target.value)} className="min-h-12 w-full rounded-xl border border-white/15 bg-black/35 px-4 text-white outline-none transition placeholder:text-white/35 focus:border-lime-300/70" required />
          </Field>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Price">
              <ManualNumberInput name="price" mode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} className="min-h-12 w-full rounded-xl border border-white/15 bg-black/35 px-4 text-white outline-none transition placeholder:text-white/35 focus:border-lime-300/70" required />
            </Field>
            {showStrain || category === "Accessories" || showEdible ? (
              <Field label={showEdible ? "Edible type" : category === "Accessories" ? "Accessory type" : "Strain type"}>
                <select name="subcategory" value={subcategory} onChange={(event) => setSubcategory(event.target.value)} className="min-h-12 w-full rounded-xl border border-white/15 bg-black/35 px-4 text-white outline-none transition focus:border-lime-300/70" required>
                  {subcategories.map((item) => <option key={item} value={item}>{displaySubcategory(item)}</option>)}
                </select>
              </Field>
            ) : <input type="hidden" name="subcategory" value={subcategory} />}
          </div>

          {showCultivation ? (
            <Field label="Cultivation type">
              <select name="cultivationType" value={cultivationType} onChange={(event) => setCultivationType(event.target.value)} className="min-h-12 w-full rounded-xl border border-white/15 bg-black/35 px-4 text-white outline-none transition focus:border-lime-300/70" required>
                {CULTIVATION_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
          ) : <input type="hidden" name="cultivationType" value="" />}

          {showEdible ? (
            <div className="grid gap-5 md:grid-cols-3">
              <Field label="Package count"><ManualNumberInput name="packageCount" mode="integer" value={ediblePackageCount} onChange={(event) => setEdiblePackageCount(event.target.value)} className="min-h-12 w-full rounded-xl border border-white/15 bg-black/35 px-4 text-white outline-none transition placeholder:text-white/35 focus:border-lime-300/70" required /></Field>
              <Field label="THC per unit"><ManualNumberInput name="thcPerUnitMg" mode="decimal" value={thcPerUnitMg} onChange={(event) => setThcPerUnitMg(event.target.value)} className="min-h-12 w-full rounded-xl border border-white/15 bg-black/35 px-4 text-white outline-none transition placeholder:text-white/35 focus:border-lime-300/70" required /></Field>
              <Field label="THC per packet"><ManualNumberInput name="thcPerPacketMg" mode="decimal" value={thcPerPacketMg} onChange={(event) => setThcPerPacketMg(event.target.value)} className="min-h-12 w-full rounded-xl border border-white/15 bg-black/35 px-4 text-white outline-none transition placeholder:text-white/35 focus:border-lime-300/70" required /></Field>
            </div>
          ) : (
            <>
              <input type="hidden" name="packageCount" value="" />
              <input type="hidden" name="thcPerUnitMg" value="" />
              <input type="hidden" name="thcPerPacketMg" value="" />
            </>
          )}
        </div>

        <footer className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="h-12 rounded-xl border border-white/15 px-6 font-bold text-white/80 transition hover:border-white/35">Cancel</button>
          <button disabled={pending} aria-busy={pending} className="inline-flex h-12 items-center justify-center gap-3 rounded-xl bg-lime-500 px-6 font-extrabold text-black transition hover:bg-lime-400 disabled:opacity-55">
            {pending ? <PendingSpinner /> : <Save size={20} />}
            {pending ? "Saving product..." : "Save Changes"}
          </button>
        </footer>
      </form>
    </div>
  );
}

export function ManagerInventoryBrowser({
  products,
  updateAction = updateProductCardAction,
  visibilityAction = updateProductPosVisibilityAction,
  archiveAction = archiveProductAction,
  backHref,
  storeName
}: {
  products: ManagerInventoryProduct[];
  updateAction?: ManagerFormAction;
  visibilityAction?: ManagerFormAction;
  archiveAction?: ManagerFormAction;
  backHref: string;
  storeName: string;
}) {
  const [localProducts, setLocalProducts] = useState(products);
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [cultivationType, setCultivationType] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [message, setMessage] = useState<POSMessage | null>(null);
  const strainPanelRef = useRef<HTMLDivElement>(null);

  const browserProducts = useMemo(() => localProducts.map(toBrowserProduct), [localProducts]);
  const categories = useMemo(() => deriveCategories(browserProducts), [browserProducts]);
  const resolvedSelection = useMemo(() => resolveProductSelection({
    products: browserProducts,
    categories,
    current: { category, subcategory, cultivationType }
  }), [browserProducts, categories, category, cultivationType, subcategory]);
  const effectiveCategory = resolvedSelection?.category ?? category;
  const effectiveSubcategory = resolvedSelection?.subcategory ?? subcategory;
  const effectiveCultivationType = resolvedSelection?.cultivationType ?? cultivationType;
  const selectedCategory = useMemo(() => effectiveCategory ? categories.find((item) => item.slug === effectiveCategory || normalize(item.name) === normalize(effectiveCategory)) ?? null : null, [categories, effectiveCategory]);
  const showCultivationFilter = categoryUsesSecondaryFilter(selectedCategory);
  const subcategoryFilters = useMemo(() => subcategoryOptions(browserProducts, selectedCategory), [browserProducts, selectedCategory]);
  const cultivationFilters = useMemo(() => getCultivationOptions(browserProducts, selectedCategory, effectiveSubcategory), [browserProducts, effectiveSubcategory, selectedCategory]);
  const visibleProducts = useMemo(() => filteredProducts({ products: browserProducts, selectedCategory, subcategory: effectiveSubcategory, showCultivationFilter, cultivationType: effectiveCultivationType }), [browserProducts, effectiveCultivationType, effectiveSubcategory, selectedCategory, showCultivationFilter]);
  const selectedProduct = useMemo(() => browserProducts.find((product) => product.id === selectedProductId) ?? null, [browserProducts, selectedProductId]);
  const hasRequiredFilters = Boolean(selectedCategory && effectiveSubcategory && (!showCultivationFilter || effectiveCultivationType));

  const selectCategory = useCallback((nextCategory: string) => {
    setCategory(nextCategory);
    setSubcategory("");
    setCultivationType("");
    setSelectedProductId(null);
  }, []);

  const selectSubcategory = useCallback((nextSubcategory: string) => {
    setCategory(effectiveCategory);
    setSubcategory(nextSubcategory);
    setCultivationType("");
    setSelectedProductId(null);
  }, [effectiveCategory]);

  const selectCultivationType = useCallback((nextCultivationType: string) => {
    setCategory(effectiveCategory);
    setSubcategory(effectiveSubcategory);
    setCultivationType(nextCultivationType);
    setSelectedProductId(null);
  }, [effectiveCategory, effectiveSubcategory]);

  function handleSaved(updatedProduct: ManagerInventoryProduct) {
    setLocalProducts((current) => current.map((product) => product.id === updatedProduct.id ? updatedProduct : product));
  }

  const handleVisibilityChanged = useCallback((productId: string, isVisibleOnPos: boolean, successMessage: string) => {
    setLocalProducts((current) => current.map((product) => product.id === productId ? { ...product, is_visible_on_pos: isVisibleOnPos, updated_at: new Date().toISOString() } : product));
    setMessage({ tone: "success", text: successMessage });
  }, []);

  const handleProductArchived = useCallback((productId: string, successMessage: string) => {
    setLocalProducts((current) => current.filter((product) => product.id !== productId));
    setMessage({ tone: "success", text: successMessage });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-[1920px] flex-col px-4 py-5 text-white sm:px-6">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <a href={backHref} className="inline-flex h-11 w-fit items-center gap-2 rounded-xl border border-white/12 bg-white/[0.055] px-4 text-sm font-bold text-white/80 transition hover:border-emerald-300/70 hover:text-emerald-300">
          <ArrowLeft size={17} />
          Back to Dashboard
        </a>
        <div className="flex items-center gap-3">
          <div className="grid size-14 place-items-center rounded-full bg-lime-500/15 text-4xl text-lime-300">{"\u2733"}</div>
          <div>
            <p className="text-2xl font-extrabold leading-none">GreenChoice</p>
            <p className="mt-1 text-xs font-bold tracking-[0.34em] text-white/78">{storeName}</p>
          </div>
        </div>
        <p className="text-sm font-semibold text-white/64 sm:text-right">Inventory browsing only</p>
      </header>

      <section className="py-5">
        <FilterPanel
          message={message}
          visibleCategories={categories}
          category={effectiveCategory}
          showCultivationFilter={showCultivationFilter}
          cultivationType={effectiveCultivationType}
          subcategory={effectiveSubcategory}
          subcategoryOptions={selectedCategory ? subcategoryFilters : []}
          cultivationOptions={cultivationFilters}
          strainPanelRef={strainPanelRef}
          onSelectCategory={selectCategory}
          onSelectCultivationType={selectCultivationType}
          onSelectSubcategory={selectSubcategory}
        />

        {browserProducts.length === 0 ? (
          <EmptyState title="No products available yet." body="Products created from Add Stock will appear here." />
        ) : !hasRequiredFilters ? (
          <EmptyState title="Select a category and filters to view products." body="Choose a category, then select the required filter buttons." />
        ) : visibleProducts.length === 0 ? (
          <EmptyState title="No matching products found." body="Try a different category or filter combination." />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,230px))] gap-3">
            {visibleProducts.map((product) => (
              <ManagerInventoryCard
                key={product.id}
                product={product}
                onEdit={setSelectedProductId}
                visibilityAction={visibilityAction}
                archiveAction={archiveAction}
                onProductArchived={handleProductArchived}
                onVisibilityChanged={handleVisibilityChanged}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="mt-auto flex flex-col gap-3 border-t border-white/10 py-4 text-sm text-white/68 sm:flex-row sm:items-center sm:justify-between">
        <p><PackageSearch className="mr-2 inline text-emerald-400" size={17} /> Browse, inspect, and edit product details. Stock additions stay on Add Stock.</p>
      </footer>

      <EditProductModal key={selectedProduct?.id ?? "empty"} product={selectedProduct} action={updateAction} onClose={() => setSelectedProductId(null)} onSaved={handleSaved} />
    </main>
  );
}
