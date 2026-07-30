"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Boxes, ImagePlus, Info, Leaf, PackagePlus, Plus, RefreshCcw, ShieldCheck, ShoppingBag, Store, Syringe, Trash2, Upload } from "lucide-react";
import { addInventoryStockAction, createProductAction } from "@/app/dashboard/manager/actions";
import { categorySlug, CULTIVATION_TYPES, PRODUCT_SUBCATEGORIES, VAPE_PRODUCT_TYPES, VAPE_STRAIN_TYPES, type ProductCategory } from "@/lib/manager/options";
import type { ManagerInventoryProduct } from "@/lib/manager/data";
import { ProductCard } from "@/components/receptionist/pos/ProductCard";
import { formatStockQuantity, initialState, ManualNumberInput, Message, PendingNotice, PendingSpinner, type ManagerFormAction } from "@/components/manager/forms/shared";

const addStockCategories = ["Flower", "Pre-Rolls", "Edibles", "Accessories", "Vape Cartridges"] as const satisfies readonly ProductCategory[];
const cultivationCategories = new Set<ProductCategory>(["Flower", "Pre-Rolls"]);
const unitCategories = new Set<ProductCategory>(["Pre-Rolls", "Edibles", "Vape Cartridges", "Accessories"]);

const categoryIcons: Record<(typeof addStockCategories)[number], typeof Leaf> = {
  Flower: Leaf,
  "Pre-Rolls": Syringe,
  Edibles: ShoppingBag,
  "Vape Cartridges": Boxes,
  Accessories: ShoppingBag
};

const addStockStyles = {
  panel: "mx-auto w-full max-w-[760px] rounded-[8px] border-2 border-lime-500/65 bg-[linear-gradient(135deg,#081a12_0%,#050a07_54%,#0b1208_100%)] p-2.5 text-white shadow-[0_18px_44px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(190,255,120,0.1),inset_0_0_36px_rgba(19,89,47,0.18)]",
  divider: "border-[#3e682f]",
  section: "rounded-[6px] border-2 border-lime-500/45 bg-[linear-gradient(135deg,#0b1c13,#050907)] p-2 shadow-[inset_0_1px_0_rgba(190,255,120,0.08),inset_0_0_22px_rgba(26,95,52,0.12)]",
  sectionStrong: "rounded-[6px] border-2 border-lime-500/55 bg-[linear-gradient(135deg,#0d2418,#06100b)] p-2 shadow-[inset_0_1px_0_rgba(190,255,120,0.1),inset_0_0_24px_rgba(30,115,62,0.14)]",
  sectionStrongPadding: "rounded-[6px] border-2 border-lime-500/55 bg-[linear-gradient(135deg,#0d2418,#06100b)] p-2.5 shadow-[inset_0_1px_0_rgba(190,255,120,0.1),inset_0_0_24px_rgba(30,115,62,0.14)]",
  infoCard: "rounded-[6px] border-2 border-lime-500/45 bg-[linear-gradient(135deg,#0c1c12,#050907)] p-2 shadow-[inset_0_1px_0_rgba(190,255,120,0.08),inset_0_0_18px_rgba(24,92,48,0.12)]",
  headerCard: "flex min-w-[160px] items-center gap-2 rounded-[6px] border-2 border-lime-500/45 bg-[linear-gradient(135deg,#0b1a12,#050907)] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(190,255,120,0.08),inset_0_0_18px_rgba(24,92,48,0.12)]",
  backLink: "inline-flex h-8 w-fit items-center gap-1.5 rounded-[6px] border-2 border-lime-500/45 bg-[linear-gradient(135deg,#0b1a12,#050907)] px-2.5 text-[11px] font-bold text-white/88 shadow-[inset_0_1px_0_rgba(190,255,120,0.08)] transition hover:border-lime-300 hover:text-lime-300 focus-visible:ring-2 focus-visible:ring-lime-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050806]",
  input: "mt-1 h-8 w-full rounded-[6px] border-2 border-lime-500/45 bg-[#030806] px-2 text-xs text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_14px_rgba(26,95,52,0.1)] outline-none transition placeholder:text-white/42 hover:border-lime-300/80 focus:border-lime-300 focus:shadow-[0_0_13px_rgba(132,204,22,0.16),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_16px_rgba(26,95,52,0.14)]",
  select: "mt-1 h-8 w-full rounded-[6px] border-2 border-lime-500/45 bg-[#030806] px-2 text-xs text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_14px_rgba(26,95,52,0.1)] outline-none transition hover:border-lime-300/80 focus:border-lime-300 focus:shadow-[0_0_13px_rgba(132,204,22,0.16),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_16px_rgba(26,95,52,0.14)] disabled:opacity-55",
  inputShell: "mt-1 flex h-8 overflow-hidden rounded-[6px] border-2 border-lime-500/45 bg-[#030806] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_14px_rgba(26,95,52,0.1)] transition focus-within:border-lime-300 focus-within:shadow-[0_0_13px_rgba(132,204,22,0.16),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_16px_rgba(26,95,52,0.14)]",
  inputInside: "min-w-0 flex-1 bg-[#030806] px-2 text-xs text-white outline-none placeholder:text-white/42",
  categoryBase: "min-h-[44px] rounded-[6px] border-2 px-1.5 py-1.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_16px_rgba(26,95,52,0.1)] transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-lime-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050806]",
  categoryActive: "border-lime-300 bg-[linear-gradient(135deg,#123a23,#0b1d12)] text-lime-200 shadow-[0_0_16px_rgba(132,204,22,0.2),inset_0_1px_0_rgba(190,255,120,0.14),inset_0_0_18px_rgba(39,143,72,0.18)]",
  categoryInactive: "border-lime-500/40 bg-[linear-gradient(135deg,#0a130d,#040806)] text-white hover:border-lime-300/75",
  neutralButton: "h-8 rounded-[6px] border-2 border-lime-500/45 bg-[#030806] px-4 text-xs font-bold text-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-lime-300",
  smallButton: "inline-flex h-7 items-center gap-1 rounded-[5px] border-2 border-lime-500/45 bg-[#030806] px-2 text-[10px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-lime-300"
};

function labelForSubcategory(category: ProductCategory | "") {
  if (category === "Edibles") return "Edible Type";
  if (category === "Accessories") return "Accessory Type";
  if (category === "Vape Cartridges") return "Subcategory";
  return "Strain Type";
}

function quantitySuffix(category: ProductCategory | "") {
  return category === "Flower" ? "g" : "units";
}

function nonNegativeDecimal(value: string) {
  const trimmed = value.trim();
  return trimmed !== "" && /^\d+(\.\d+)?$/.test(trimmed) && Number(trimmed) >= 0;
}

const allowedPreviewImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxPreviewImageBytes = 6 * 1024 * 1024;

function isCanonicalVapeProduct(product: ManagerInventoryProduct, vapeSubcategory: string, strainType: string) {
  if (!vapeSubcategory || !strainType) return false;
  const canonicalMatch = product.category === "Vape Cartridges" && product.subcategory === vapeSubcategory && product.cultivation_type === strainType;
  const legacyRegularMatch = vapeSubcategory === "Vape Cartridge" && product.category === "Vape Cartridges" && product.subcategory === strainType && !product.cultivation_type;
  const legacyDisposableMatch = vapeSubcategory === "Disposable Vape" && product.category === "Disposable Vapes" && product.subcategory === strainType && !product.cultivation_type;
  return canonicalMatch || legacyRegularMatch || legacyDisposableMatch;
}

export function CombinedAddStockForm({
  products,
  createAction = createProductAction,
  addStockAction = addInventoryStockAction,
  backHref,
  storeName,
  managerName
}: {
  products: ManagerInventoryProduct[];
  createAction?: ManagerFormAction;
  addStockAction?: ManagerFormAction;
  backHref: string;
  storeName: string;
  managerName: string;
}) {
  const router = useRouter();
  const [createState, createFormAction, createPending] = useActionState(createAction, initialState);
  const [stockState, stockFormAction, stockPending] = useActionState(addStockAction, initialState);
  const handledCreateStateRef = useRef<typeof createState | null>(null);
  const handledStockStateRef = useRef<typeof stockState | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [localProducts, setLocalProducts] = useState(products);
  const [category, setCategory] = useState<ProductCategory | "">("");
  const [subcategory, setSubcategory] = useState("");
  const [cultivationType, setCultivationType] = useState("");
  const [thcPerUnitMg, setThcPerUnitMg] = useState("");
  const [thcPerPacketMg, setThcPerPacketMg] = useState("");
  const [productId, setProductId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [quantityToAdd, setQuantityToAdd] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  const showVape = category === "Vape Cartridges";
  const subcategories = category ? (showVape ? [...VAPE_PRODUCT_TYPES] : PRODUCT_SUBCATEGORIES[category].filter((item) => category !== "Accessories" || ["Lighters", "Rolling Papers", "Grinders", "Pipes", "Storage Containers", "Trays"].includes(item))) : [];
  const showCultivation = category ? cultivationCategories.has(category) : false;
  const showStrainType = showCultivation || showVape;
  const strainTypeOptions = showVape ? [...VAPE_STRAIN_TYPES] : [...CULTIVATION_TYPES];
  const showEdible = category === "Edibles";
  const productDetailsReady = Boolean(
    category &&
      subcategory &&
      (!showStrainType || cultivationType)
  );
  const newProductReady = showCreate && productName.trim().length > 0 && Number(price) > 0 && (!showEdible || (nonNegativeDecimal(thcPerUnitMg) && nonNegativeDecimal(thcPerPacketMg)));

  const filteredProducts = useMemo(() => {
    if (!productDetailsReady) return [];
    return localProducts.filter((product) => {
      if (showVape) return isCanonicalVapeProduct(product, subcategory, cultivationType);
      if (product.category !== category || product.subcategory !== subcategory) return false;
      if (showCultivation && product.cultivation_type !== cultivationType) return false;
      if (!showCultivation && product.cultivation_type) return false;
      return true;
    });
  }, [category, cultivationType, localProducts, productDetailsReady, showCultivation, showVape, subcategory]);

  const selectedProduct = localProducts.find((product) => product.id === productId);
  const savedImageUrl = removeExistingImage ? null : selectedProduct?.image_url ?? null;
  const currentStock = showCreate ? 0 : selectedProduct?.inventory_stock?.current_quantity ?? null;
  const parsedQuantity = quantityToAdd.trim() ? Number(quantityToAdd) : null;
  const validQuantity = parsedQuantity !== null && Number.isFinite(parsedQuantity) && parsedQuantity > 0 && (!category || !unitCategories.has(category) || Number.isInteger(parsedQuantity));
  const newTotal = currentStock !== null && validQuantity ? Number(currentStock) + Number(parsedQuantity) : null;
  const creatingProductWithStock = showCreate;
  const stockPendingForMode = creatingProductWithStock ? createPending : stockPending;
  const canAddStock = productDetailsReady && validQuantity && (creatingProductWithStock ? newProductReady && !createPending : Boolean(productId) && !stockPending);
  const canCreateProduct = productDetailsReady && productName.trim().length > 0 && Number(price) > 0 && !createPending;
  const productImageFormId = "add-stock-submit-form";
  const previewProduct = {
    id: selectedProduct?.id ?? "preview-product",
    name: showCreate ? productName.trim() || "Product Name" : selectedProduct?.product_name || productName.trim() || "Product Name",
    categoryName: category || "Accessories",
    categorySlug: category ? categorySlug(category) : "accessories",
    subcategory: subcategory || "General",
    cultivationType: showStrainType ? cultivationType || null : null,
    description: "",
    thcPerUnitMg: showEdible && nonNegativeDecimal(thcPerUnitMg) ? Number(thcPerUnitMg) : selectedProduct?.thc_per_unit_mg ?? null,
    thcPerPacketMg: showEdible && nonNegativeDecimal(thcPerPacketMg) ? Number(thcPerPacketMg) : selectedProduct?.thc_per_packet_mg ?? null,
    imageUrl: imagePreviewUrl || savedImageUrl,
    imagePath: selectedProduct?.image_path ?? null,
    sizeLabel: category ? quantitySuffix(category) : null,
    strainType: showStrainType ? cultivationType || null : null,
    sellingPrice: showCreate ? Number(price) || 0 : selectedProduct?.price ?? (Number(price) || 0),
    productStatus: "active",
    isActive: true,
    isNew: false,
    quantityAvailable: newTotal ?? currentStock ?? 0,
    lowStockThreshold: selectedProduct?.inventory_stock?.low_stock_threshold ?? 5
  };

  function clearFormFields() {
    setCategory("");
    setSubcategory("");
    setCultivationType("");
    setThcPerUnitMg("");
    setThcPerPacketMg("");
    setProductId("");
    setShowCreate(false);
    setProductName("");
    setPrice("");
    setQuantityToAdd("");
    setRemoveExistingImage(false);
    setImageError("");
    setImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

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
    if (!allowedPreviewImageTypes.has(file.type)) {
      clearSelectedPicture();
      setImageError("Choose a PNG, JPG, JPEG, or WebP image.");
      return;
    }
    if (file.size > maxPreviewImageBytes) {
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
    const createdProduct = createState.createdProduct;
    if (!createState.ok || !createdProduct) return;
    if (handledCreateStateRef.current === createState) return;
    handledCreateStateRef.current = createState;
    const timeoutId = window.setTimeout(() => {
      setLocalProducts((current) => {
        if (current.some((product) => product.id === createdProduct.id)) return current;
        return [createdProduct, ...current];
      });
      clearFormFields();
      setSuccessMessage(createState.message || "Product created and form reset.");
      router.refresh();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [createState, router]);

  useEffect(() => {
    if (!stockState.ok) return;
    if (handledStockStateRef.current === stockState) return;
    handledStockStateRef.current = stockState;
    const timeoutId = window.setTimeout(() => {
      if (stockState.updatedStock !== undefined && productId) {
        setLocalProducts((current) => current.map((product) => product.id === productId ? {
          ...product,
          inventory_stock: {
            current_quantity: stockState.updatedStock ?? 0,
            low_stock_threshold: product.inventory_stock?.low_stock_threshold ?? 5,
            updated_at: new Date().toISOString()
          }
        } : product));
      }
      clearFormFields();
      setSuccessMessage(stockState.message || "Stock added and form reset.");
      router.refresh();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [productId, router, stockState]);

  function resetForCategory(nextCategory: ProductCategory) {
    setSuccessMessage("");
    setCategory(nextCategory);
    const nextSubcategory = nextCategory === "Vape Cartridges" ? "" : PRODUCT_SUBCATEGORIES[nextCategory][0] ?? "";
    setSubcategory(nextSubcategory);
    setCultivationType(nextCategory === "Vape Cartridges" ? "" : cultivationCategories.has(nextCategory) ? "Indoor" : "");
    setThcPerUnitMg("");
    setThcPerPacketMg("");
    setProductId("");
    setShowCreate(false);
    setProductName("");
    setPrice("");
    setQuantityToAdd("");
    clearSelectedPicture();
  }

  function resetForm() {
    setSuccessMessage("");
    clearFormFields();
  }

  function hiddenFields() {
    return (
      <>
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="subcategory" value={subcategory} />
        <input type="hidden" name="cultivationType" value={showStrainType ? cultivationType : ""} />
        <input type="hidden" name="packageCount" value="" />
        <input type="hidden" name="thcPerUnitMg" value={showEdible ? thcPerUnitMg : ""} />
        <input type="hidden" name="thcPerPacketMg" value={showEdible ? thcPerPacketMg : ""} />
        <input type="hidden" name="removeProductImage" value={removeExistingImage ? "1" : ""} />
      </>
    );
  }

  const summaryRows = [
    ["Category", category],
    [labelForSubcategory(category), subcategory],
    ...(showCultivation ? [["Cultivation Type", cultivationType]] : []),
    ...(showVape ? [["Strain Type", cultivationType]] : []),
    ...(showCreate ? [["Price", price ? `R ${Number(price).toFixed(2)}` : ""]] : []),
    ...(showEdible && showCreate ? [["THC per Unit", thcPerUnitMg ? `${thcPerUnitMg} mg` : ""], ["THC per Pack", thcPerPacketMg ? `${thcPerPacketMg} mg` : ""]] : []),
    ["Product", showCreate ? productName.trim() : selectedProduct?.product_name ?? ""],
    ["Current Stock", formatStockQuantity(currentStock, category)],
    ["Quantity to Add", validQuantity ? `${parsedQuantity} ${quantitySuffix(category)}` : ""],
    ["New Total Stock", newTotal !== null ? formatStockQuantity(newTotal, category) : ""]
  ];

  return (
    <div className={addStockStyles.panel}>
      <header className={`grid gap-2 border-b ${addStockStyles.divider} pb-2 md:grid-cols-[auto_minmax(180px,1fr)_auto] md:items-center`}>
        <a href={backHref} className={addStockStyles.backLink}>
          <ArrowRight className="rotate-180 text-lime-300" size={14} />
          Back to Dashboard
        </a>
        <div className="flex items-center gap-2 rounded-[6px] border-2 border-lime-500/35 bg-[linear-gradient(135deg,#0b1a12,#050907)] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(190,255,120,0.08),inset_0_0_16px_rgba(24,92,48,0.1)] md:justify-center">
          <Leaf className="text-lime-300" size={22} fill="currentColor" />
          <div>
            <p className="text-base font-extrabold leading-none">Green<span className="text-lime-400">Choice</span></p>
            <p className="text-[10px] text-white/75">Dispensary System</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className={addStockStyles.headerCard}>
            <Store className="text-lime-300" size={16} />
            <div>
              <p className="text-[10px] text-white/68">Active Store</p>
              <p className="text-[11px] font-bold leading-tight text-lime-300">{storeName}</p>
            </div>
          </div>
          <div className={addStockStyles.headerCard}>
            <Leaf className="text-lime-300" size={15} />
            <div>
              <p className="text-[11px] font-bold leading-tight">{managerName}</p>
              <p className="text-[10px] text-white/72">Manager</p>
            </div>
          </div>
        </div>
      </header>

      <section className={`grid gap-2 border-b ${addStockStyles.divider} py-2 md:grid-cols-[1fr_230px]`}>
        <div>
          <h1 className="text-xl font-extrabold leading-tight sm:text-2xl">Add Stock</h1>
          <p className="mt-1 text-xs leading-4 text-white/78">Add stock to an existing product or create a new product, all in one place.</p>
        </div>
        <aside className={addStockStyles.infoCard}>
          <p className="flex items-center gap-2 text-xs font-extrabold"><Info size={14} /> How it works</p>
          <p className="mt-1 text-[11px] leading-4 text-white/75">Select category, product, quantity, then save.</p>
        </aside>
      </section>

      <section className={`border-b ${addStockStyles.divider} py-2`}>
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold"><span className="text-base text-lime-300">1.</span> Select Category</h2>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {addStockCategories.map((item) => {
            const Icon = categoryIcons[item];
            const active = item === category;
            return (
              <button key={item} type="button" onClick={() => resetForCategory(item)} className={`${addStockStyles.categoryBase} ${active ? addStockStyles.categoryActive : addStockStyles.categoryInactive}`}>
                <Icon className="mx-auto" size={16} />
                <span className="mt-1 block text-[10px] font-extrabold leading-tight">{item}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-2 py-2">
        <div className="space-y-2">
          {successMessage ? <p className="rounded-[6px] border-2 border-lime-300/45 bg-[#102516] px-3 py-2 text-xs font-bold text-lime-100 shadow-[inset_0_1px_0_rgba(190,255,120,0.08)]">{successMessage}</p> : null}
          <section className={addStockStyles.section}>
            <h2 className="flex items-center gap-1.5 text-sm font-extrabold"><span className="text-base text-lime-300">2.</span> Product & Details</h2>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="text-xs font-medium text-white/88">
                {labelForSubcategory(category)}
                <select value={subcategory} onChange={(event) => { setSuccessMessage(""); setSubcategory(event.target.value); setProductId(""); setShowCreate(false); setProductName(""); setPrice(""); setThcPerUnitMg(""); setThcPerPacketMg(""); clearSelectedPicture(); }} className={addStockStyles.select}>
                  {showVape ? <option value="">Select vape subcategory...</option> : null}
                  {subcategories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              {showStrainType ? (
                <label className="text-xs font-medium text-white/88">
                  {showVape ? "Strain Type" : "Cultivation Type"}
                  <select value={cultivationType} onChange={(event) => { setSuccessMessage(""); setCultivationType(event.target.value); setProductId(""); setShowCreate(false); clearSelectedPicture(); }} className={addStockStyles.select}>
                    <option value="">{showVape ? "Select strain type..." : "Select cultivation type..."}</option>
                    {strainTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              ) : null}
              <label className="text-xs font-medium text-white/88 md:col-span-2">
                Product
                <select value={showCreate ? "__create__" : productId} disabled={!productDetailsReady} onChange={(event) => { setSuccessMessage(""); clearSelectedPicture(); if (event.target.value === "__create__") { setShowCreate(true); setProductId(""); setProductName(""); setPrice(""); setThcPerUnitMg(""); setThcPerPacketMg(""); return; } setProductId(event.target.value); setShowCreate(false); setProductName(""); setPrice(""); setThcPerUnitMg(""); setThcPerPacketMg(""); }} className={addStockStyles.select}>
                  <option value="">{productDetailsReady ? "Select an existing product..." : "Complete details first..."}</option>
                  {filteredProducts.map((product) => <option key={product.id} value={product.id}>{product.product_name}</option>)}
                  <option value="__create__">+ Add New Product</option>
                </select>
              </label>
            </div>
          </section>

          {showCreate && showEdible ? (
            <section className={addStockStyles.sectionStrong}>
              <div className="mb-2 flex items-center gap-1.5 text-lime-300">
                <Plus size={15} />
                <h3 className="text-xs font-extrabold">Add New Edible Product</h3>
                <span className="rounded-full bg-[#2a4b13] px-2 py-0.5 text-[10px] font-extrabold text-lime-100">{subcategory}</span>
              </div>
              <PendingNotice active={createPending} text="Creating product..." />
              {!createPending && !createState.ok ? <Message state={createState} /> : null}
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs font-medium text-white/88">Product Brand Name<input value={productName} onChange={(event) => { setSuccessMessage(""); setProductName(event.target.value); }} className={addStockStyles.input} placeholder="Enter brand name" required /></label>
                <label className="text-xs font-medium text-white/88">Price (ZAR)<span className={addStockStyles.inputShell}><span className="grid w-8 place-items-center border-r border-[#3c5a2d] text-xs font-bold">R</span><ManualNumberInput mode="decimal" value={price} onChange={(event) => { setSuccessMessage(""); setPrice(event.target.value); }} className={addStockStyles.inputInside} placeholder="Enter price" required /></span></label>
                <label className="text-xs font-medium text-white/88">THC per Unit<ManualNumberInput mode="decimal" value={thcPerUnitMg} onChange={(event) => { setSuccessMessage(""); setThcPerUnitMg(event.target.value); }} className={addStockStyles.input} placeholder="mg" required /></label>
                <label className="text-xs font-medium text-white/88">THC per Pack<ManualNumberInput mode="decimal" value={thcPerPacketMg} onChange={(event) => { setSuccessMessage(""); setThcPerPacketMg(event.target.value); }} className={addStockStyles.input} placeholder="mg" required /></label>
              </div>
            </section>
          ) : showCreate ? (
            <form id="create-product-submit-form" action={createFormAction} encType="multipart/form-data" className={addStockStyles.sectionStrong}>
              {hiddenFields()}
              <input type="hidden" name="productStatus" value="active" />
              <div className="mb-2 flex items-center gap-1.5 text-lime-300">
                <Plus size={15} />
                <h3 className="text-xs font-extrabold">Create New Product</h3>
                <span className="rounded-full bg-[#2a4b13] px-2 py-0.5 text-[10px] font-extrabold text-lime-100">New</span>
              </div>
              {!createState.ok ? <Message state={createState} /> : null}
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-medium text-white/88">Product Name<input name="productName" value={productName} onChange={(event) => { setSuccessMessage(""); setProductName(event.target.value); }} className={addStockStyles.input} placeholder="Enter product name" required /></label>
                <label className="text-xs font-medium text-white/88">Price (ZAR)<span className={addStockStyles.inputShell}><span className="grid w-8 place-items-center border-r border-[#3c5a2d] text-xs font-bold">R</span><ManualNumberInput mode="decimal" name="price" value={price} onChange={(event) => { setSuccessMessage(""); setPrice(event.target.value); }} className={addStockStyles.inputInside} placeholder="Enter price" required /></span></label>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setShowCreate(false); setProductName(""); setPrice(""); }} className={addStockStyles.neutralButton}>Cancel</button>
                <button disabled={!canCreateProduct} aria-busy={createPending} className="inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border-2 border-lime-300/55 bg-lime-500 px-4 text-xs font-extrabold text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:bg-lime-400 focus-visible:ring-2 focus-visible:ring-lime-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050806] disabled:opacity-55">{createPending ? <><PendingSpinner /> Creating...</> : "Create Product"}</button>
              </div>
            </form>
          ) : createState.message && !createState.ok ? <Message state={createState} /> : null}

          <form action={creatingProductWithStock ? createFormAction : stockFormAction} encType="multipart/form-data" className={addStockStyles.section}>
            {hiddenFields()}
            {creatingProductWithStock ? (
              <>
                <input type="hidden" name="productName" value={productName} />
                <input type="hidden" name="price" value={price} />
                <input type="hidden" name="productStatus" value="active" />
                <input type="hidden" name="initialStockQuantity" value={quantityToAdd} />
              </>
            ) : null}
            <input type="hidden" name="productId" value={productId} />
            <h2 className="flex items-center gap-1.5 text-sm font-extrabold"><span className="text-base text-lime-300">3.</span> Add Stock Quantity</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-[0.9fr_1.1fr]">
              <label className="text-xs font-medium text-white/88">Quantity to Add<span className={addStockStyles.inputShell}><ManualNumberInput mode="integer" name="quantityToAdd" value={quantityToAdd} onChange={(event) => { setSuccessMessage(""); setQuantityToAdd(event.target.value); }} className={addStockStyles.inputInside} placeholder="Enter quantity" required /><span className="grid min-w-8 place-items-center border-l border-[#3c5a2d] text-xs">{quantitySuffix(category)}</span></span><span className="mt-1 block text-[11px] text-white/58">Amount of stock to add.</span></label>
              <div className="rounded-[6px] border-2 border-lime-500/50 bg-[linear-gradient(135deg,#0a1911,#040806)] p-2 text-center shadow-[inset_0_1px_0_rgba(190,255,120,0.08),inset_0_0_18px_rgba(26,95,52,0.12)]">
                <p className="text-xs text-white/80">New Total Stock</p>
                <p className="mt-2 flex items-center justify-center gap-3 text-base font-bold"><span className="text-lime-300">{formatStockQuantity(currentStock, category)}</span><ArrowRight size={15} /><span className="text-lime-300">{newTotal !== null ? formatStockQuantity(newTotal, category) : "-"}</span></p>
                <p className="mt-1 text-[11px] text-white/65">Current + Quantity</p>
              </div>
            </div>
            <div className="mt-2">
              <PendingNotice active={stockPendingForMode} text={creatingProductWithStock ? "Creating product and adding stock..." : "Adding stock..."} />
              {!stockPendingForMode ? (creatingProductWithStock ? (!createState.ok ? <Message state={createState} /> : null) : (!stockState.ok ? <Message state={stockState} /> : null)) : null}
            </div>
          </form>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className={addStockStyles.section}>
              <p className="flex items-center gap-1.5 text-xs font-extrabold"><ShieldCheck className="text-lime-300" size={15} /> Quality & Accuracy</p>
              <p className="mt-1 text-[11px] leading-4 text-white/70">All stock updates are recorded.</p>
            </div>
            <div className={addStockStyles.section}>
              <input ref={imageInputRef} form={productImageFormId} name="productImage" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => selectProductImage(event.target.files?.[0] ?? null)} />
              <div className="flex items-start gap-2">
                <ImagePlus className="mt-0.5 shrink-0 text-lime-300" size={16} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold">Add Product Picture <span className="font-semibold text-white/55">(optional)</span></p>
                  <p className="mt-1 text-[11px] leading-4 text-white/70">Save without a picture to use the default product image.</p>
                  {imageError ? <p className="mt-1 text-[11px] font-bold text-red-300">{imageError}</p> : null}
                  {imagePreviewUrl || savedImageUrl ? (
                    <div className="mt-2 flex items-center gap-2">
                      {/* Local blob previews are never submitted to the database; only the selected File is uploaded on save. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreviewUrl || savedImageUrl || ""} alt="Selected product preview" className="size-12 rounded-[6px] border-2 border-lime-500/40 bg-white object-cover" />
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => imageInputRef.current?.click()} className={addStockStyles.smallButton}><Upload size={12} /> Change Picture</button>
                        <button type="button" onClick={() => clearSelectedPicture({ removeSaved: !imagePreviewUrl && Boolean(savedImageUrl) })} className="inline-flex h-7 items-center gap-1 rounded-[5px] border-2 border-red-300/45 bg-[#230807] px-2 text-[10px] font-bold text-red-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-red-200"><Trash2 size={12} /> Remove Picture</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => imageInputRef.current?.click()} className={`mt-2 ${addStockStyles.smallButton}`}><Upload size={12} /> Add Product Picture</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="grid gap-2 md:grid-cols-[1fr_190px] md:items-start">
          <section className={addStockStyles.sectionStrongPadding}>
            <h2 className="text-base font-extrabold">Summary</h2>
            <div className="mt-2 space-y-1 text-xs">
              {summaryRows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-2 border-b border-[#263822] pb-1 last:border-b-0">
                  <span className="text-white/75">{label}</span>
                  <span className="text-right font-medium">{value || "-"}</span>
                </div>
              ))}
            </div>
          </section>
          <div className="grid gap-2">
            <form id="add-stock-submit-form" action={creatingProductWithStock ? createFormAction : stockFormAction} encType="multipart/form-data">
              {hiddenFields()}
              {creatingProductWithStock ? (
                <>
                  <input type="hidden" name="productName" value={productName} />
                  <input type="hidden" name="price" value={price} />
                  <input type="hidden" name="productStatus" value="active" />
                  <input type="hidden" name="initialStockQuantity" value={quantityToAdd} />
                </>
              ) : null}
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="quantityToAdd" value={quantityToAdd} />
              <button disabled={!canAddStock} aria-busy={stockPendingForMode} className="flex h-10 w-full items-center justify-center gap-2 rounded-[6px] border-2 border-lime-300/55 bg-lime-500 text-sm font-extrabold text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:bg-lime-400 focus-visible:ring-2 focus-visible:ring-lime-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050806] disabled:opacity-55">
                {stockPendingForMode ? <PendingSpinner /> : <PackagePlus size={17} />}
                {stockPendingForMode ? "Adding stock..." : "Add Stock"}
              </button>
            </form>
            <button type="button" onClick={resetForm} className="flex h-10 w-full items-center justify-center gap-2 rounded-[6px] border-2 border-lime-500/45 bg-[#030806] text-xs font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-lime-300">
              <RefreshCcw size={15} />
              Reset Form
            </button>
            <section className="overflow-hidden rounded-[6px] border-2 border-lime-500/45 bg-[linear-gradient(135deg,#0a130d,#040806)] p-2 shadow-[inset_0_1px_0_rgba(190,255,120,0.08),inset_0_0_18px_rgba(26,95,52,0.1)]">
              <h2 className="mb-1.5 text-[11px] font-extrabold text-white/88">Product Card Preview</h2>
              <div className="h-[350px] overflow-hidden">
                <div className="origin-top-left scale-[0.68]" style={{ width: "147.06%" }}>
                  <ProductCard product={previewProduct} onAddToCart={() => undefined} onOpenDescription={() => undefined} />
                </div>
              </div>
            </section>
          </div>
        </aside>
      </section>
    </div>
  );
}
