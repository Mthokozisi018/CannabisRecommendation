"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, ArrowRight, Boxes, Droplet, ImagePlus, Info, Leaf, PackagePlus, Plus, RefreshCcw, ShieldCheck, ShoppingBag, Store, Syringe, Trash2, Upload, UserRound, X } from "lucide-react";
import { addInventoryStockAction, createProductAction } from "@/app/dashboard/manager/actions";
import { registerAddStockSupplier, type AddStockSupplierState } from "@/app/dashboard/manager/inventory/manage/actions";
import { CULTIVATION_TYPES, isProductCategory, PRODUCT_CATEGORIES, PRODUCT_SUBCATEGORIES, type ProductCategory } from "@/lib/manager/options";
import { SUPPLIER_CATEGORIES, supplierCategoryLabel, supplierSubcategories } from "@/lib/manager/supplier-options";
import { hasAddStockClassification } from "@/lib/manager/add-stock-validation";
import type { AddStockSupplier } from "@/lib/manager/add-stock-suppliers";
import type { ManagerInventoryProduct } from "@/lib/manager/data";
import { getProductImage } from "@/lib/product-images";
import { formatStockQuantity, initialState, ManualNumberInput, PendingSpinner, type ManagerFormAction } from "./shared";
import styles from "./AddStockForm.module.css";

// Legacy disposable vapes remain selectable within the existing Vape Cartridges workflow.
const categories = PRODUCT_CATEGORIES.filter((category) => category !== "Disposable Vapes" && category !== "Beverages");
const icons = { Flower: Leaf, "Pre-Rolls": Syringe, Edibles: ShoppingBag, Accessories: ShoppingBag, "Vape Cartridges": Boxes, Concentrates: Droplet, "Disposable Vapes": Boxes, Beverages: Droplet };
const money = (value: string) => /^\d+(\.\d{1,2})?$/.test(value.trim());
const nonNegativeDecimal = (value: string) => /^\d+(\.\d+)?$/.test(value.trim());

export function AddStockForm({ products, suppliers, backHref, storeName, managerName, createAction = createProductAction, addStockAction = addInventoryStockAction }: {
  products: ManagerInventoryProduct[]; suppliers: AddStockSupplier[]; backHref: Route; storeName: string; managerName: string;
  createAction?: ManagerFormAction; addStockAction?: ManagerFormAction;
}) {
  const router = useRouter();
  const [createState, createFormAction, createPending] = useActionState(createAction, initialState);
  const [stockState, stockFormAction, stockPending] = useActionState(addStockAction, initialState);
  const handledStates = useRef(new WeakSet<object>());
  const imageInput = useRef<HTMLInputElement>(null);
  const [localProducts, setLocalProducts] = useState(products);
  const [localSuppliers, setLocalSuppliers] = useState(suppliers);
  const [category, setCategory] = useState<ProductCategory | "">("");
  const [subcategory, setSubcategory] = useState("");
  const [cultivationType, setCultivationType] = useState("");
  const [productId, setProductId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [thcPerUnitMg, setThcPerUnitMg] = useState("");
  const [thcPerPacketMg, setThcPerPacketMg] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierUnitCost, setSupplierUnitCost] = useState("");
  const [quantity, setQuantity] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [imageError, setImageError] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [success, setSuccess] = useState("");
  const [supplierDialog, setSupplierDialog] = useState(false);
  const classification = hasAddStockClassification(category);
  const requiresSubtypeSelection = classification || category === "Accessories";
  const selectedProduct = localProducts.find((product) => product.id === productId);
  const selectedSubtype = showCreate || requiresSubtypeSelection ? subcategory : selectedProduct?.subcategory ?? "";
  const supplierCategory = selectedProduct?.category === "Disposable Vapes" ? "Disposable Vapes" : category;
  const supplierSubtype = classification ? cultivationType : selectedSubtype;
  const availableSuppliers = localSuppliers.filter((supplier) => supplier.categories.some((mapping) => mapping.category === supplierCategory && mapping.subcategory === supplierSubtype));
  const selectedSupplier = availableSuppliers.find((supplier) => supplier.id === supplierId);
  const pending = createPending || stockPending;
  const state = showCreate ? createState : stockState;
  const currentStock = showCreate ? 0 : selectedProduct?.inventory_stock?.current_quantity ?? null;
  const validQuantity = /^\d+$/.test(quantity) && Number.isSafeInteger(Number(quantity)) && Number(quantity) > 0;
  const total = currentStock !== null && validQuantity ? Number(currentStock) + Number(quantity) : null;
  const productSelectionReady = classification ? Boolean(subcategory && cultivationType) : !requiresSubtypeSelection || Boolean(subcategory);
  const createReady = productName.trim().length > 0 && money(price) && Number(price) > 0 && selectedSubtype && (category !== "Edibles" || (nonNegativeDecimal(thcPerUnitMg) && nonNegativeDecimal(thcPerPacketMg)));
  const canSubmit = Boolean(category && productSelectionReady && validQuantity && selectedSupplier && money(supplierUnitCost) && !imageError && !pending && (showCreate ? createReady : selectedProduct));
  const filteredProducts = useMemo(() => localProducts.filter((product) => {
    if (category === "Vape Cartridges" && product.category === "Disposable Vapes") return true;
    if (product.category !== category) return false;
    if (classification) return product.subcategory === subcategory && product.cultivation_type === cultivationType;
    return category !== "Accessories" || product.subcategory === subcategory;
  }), [localProducts, category, classification, subcategory, cultivationType]);

  function clearPicture(removeSaved = false) {
    setImagePreview(""); setImageError(""); setRemoveImage(removeSaved);
    if (imageInput.current) imageInput.current.value = "";
  }
  function clearProduct() {
    setProductId(""); setShowCreate(false); setProductName(""); setPrice(""); setThcPerUnitMg(""); setThcPerPacketMg(""); setSupplierId(""); clearPicture();
  }
  function reset() {
    setCategory(""); setSubcategory(""); setCultivationType(""); setQuantity(""); setSupplierUnitCost(""); setSuccess(""); clearProduct();
  }
  function changeCategory(next: ProductCategory) {
    reset(); setCategory(next);
  }
  function chooseImage(file?: File) {
    setImagePreview(""); setImageError(""); setRemoveImage(false);
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { clearPicture(); setImageError("Choose a PNG, JPG, JPEG, or WebP image."); return; }
    if (file.size > 6 * 1024 * 1024) { clearPicture(); setImageError("Image must be 6MB or smaller."); return; }
    setImagePreview(URL.createObjectURL(file));
  }
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);
  useEffect(() => {
    const result = [createState, stockState].find((candidate) => candidate.ok && !handledStates.current.has(candidate));
    if (!result) return;
    handledStates.current.add(result);
    const timer = window.setTimeout(() => {
      if (result.createdProduct) setLocalProducts((current) => [result.createdProduct!, ...current.filter((product) => product.id !== result.createdProduct!.id)]);
      else if (result.updatedStock !== undefined) setLocalProducts((current) => current.map((product) => product.id === productId ? { ...product, inventory_stock: { current_quantity: result.updatedStock!, low_stock_threshold: product.inventory_stock?.low_stock_threshold ?? 5, updated_at: new Date().toISOString() } } : product));
      reset(); setSuccess(result.message); router.refresh();
    }, 0);
    return () => window.clearTimeout(timer);
    // Reset helpers only set state; the result identity prevents handling a receipt twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createState, stockState, productId, router]);

  const previewName = (showCreate ? productName.trim() : selectedProduct?.product_name) || category;
  const previewAlt = selectedProduct?.product_name || productName.trim() || `${category} product preview`;
  const savedImage = removeImage ? null : selectedProduct?.image_url;
  const previewImage = getProductImage({ image_url: imagePreview || savedImage, category, subcategory: selectedSubtype, cultivation_type: classification ? cultivationType : null });
  const actions = <div className={styles.actions}>
    <form id="manager-add-stock" action={showCreate ? createFormAction : stockFormAction}>
      {Object.entries({ workflow: "add-stock", category: selectedProduct?.category ?? category, subcategory: selectedSubtype, cultivationType: classification ? cultivationType : "", productId, quantityToAdd: quantity, productName, price, productStatus: "active", initialStockQuantity: quantity, packageCount: "", thcPerUnitMg: category === "Edibles" ? thcPerUnitMg : "", thcPerPacketMg: category === "Edibles" ? thcPerPacketMg : "", supplierId: selectedSupplier?.id ?? "", supplierUnitCost, removeProductImage: removeImage ? "1" : "" }).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <button className={styles.submit} disabled={!canSubmit} aria-busy={pending}>{pending ? <PendingSpinner /> : <PackagePlus />}{pending ? "Adding stock..." : "Add Stock"}</button>
    </form>
    <button type="button" className={styles.reset} onClick={reset}><RefreshCcw />Reset Form</button>
    {!state.ok && state.message && <p role="alert" className={styles.error}>{state.message}</p>}
  </div>;
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href={backHref} className={styles.back} title="Back to dashboard" aria-label="Back to dashboard"><ArrowLeft /></Link>
      <Link href={backHref} className={styles.brand}><Leaf size={40} /><span><strong>Green<span>Choice</span></strong><small>Dispensary System</small></span></Link>
      <div className={styles.store}><Store /><span><small>Active Store</small><strong>{storeName}</strong></span></div>
      <Link href="/dashboard/account" className={styles.account} title="My account"><UserRound /><span><strong>{managerName}</strong><small>Manager</small></span></Link>
    </header>
    <div className={styles.layout}>
      <div className={styles.heading}><h1>Add Stock</h1><p>Add stock to an existing product or create a new product, all in one place.</p>{success && <p role="status" className={styles.success}>{success}</p>}</div>
      <aside className={`${styles.section} ${styles.help}`}><Info /><div><h2>How it works</h2><p>Select category, product, quantity, then save.</p></div></aside>
      <fieldset className={styles.workflow} disabled={pending}>
        <section className={`${styles.section} ${styles.categories}`}><h2><span className={styles.step}>1</span>Select Category</h2><div className={styles.categoryGrid}>{categories.map((item) => { const Icon = icons[item]; return <button type="button" key={item} aria-pressed={category === item} onClick={() => changeCategory(item)} className={styles.category}><Icon /><span>{item}</span></button>; })}</div></section>
        <section className={`${styles.section} ${styles.details}`}><h2><span className={styles.step}>2</span>Product &amp; Details</h2>
          {classification && <div className={styles.classification}>
            <label>Cultivation Type <span aria-hidden="true">*</span><select value={cultivationType} onChange={(event) => { setCultivationType(event.target.value); clearProduct(); }} required><option value="">Select cultivation type</option>{CULTIVATION_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Strain Type <span aria-hidden="true">*</span><select value={subcategory} onChange={(event) => { setSubcategory(event.target.value); clearProduct(); }} required><option value="">Select strain type</option>{PRODUCT_SUBCATEGORIES[category as ProductCategory].map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>}
          {category === "Accessories" && <div className={styles.subcategorySelection}>
            <label>Accessory Type <span aria-hidden="true">*</span><select value={subcategory} onChange={(event) => { setSubcategory(event.target.value); clearProduct(); }} required><option value="">Select accessory type</option>{PRODUCT_SUBCATEGORIES.Accessories.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>}
          <div className={styles.selectionRow}><label>Product <span aria-hidden="true">*</span><select value={productId} disabled={!category || !productSelectionReady || showCreate} onChange={(event) => { clearProduct(); setProductId(event.target.value); setSuccess(""); }}><option value="">{showCreate ? "Creating new product" : "Select product"}</option>{filteredProducts.map((product) => <option key={product.id} value={product.id}>{product.product_name}</option>)}</select></label><button type="button" className={styles.secondary} disabled={!category || !productSelectionReady} onClick={() => { clearProduct(); setShowCreate(true); if (!requiresSubtypeSelection) setSubcategory(PRODUCT_SUBCATEGORIES[category as ProductCategory][0]); }}><Plus />New Product</button></div>
          {category && productSelectionReady && !filteredProducts.length && !showCreate && <p className={styles.muted}>No products match this selection.</p>}
          {showCreate && <div className={styles.creation}>
            <div className={styles.creationTitle}><h3>New Product</h3><button type="button" onClick={clearProduct} aria-label="Cancel new product" title="Cancel new product"><X /></button></div>
            <div className={styles.fields}>
              {!requiresSubtypeSelection && <label>Product Type <span aria-hidden="true">*</span><select value={subcategory} onChange={(event) => { setSubcategory(event.target.value); setSupplierId(""); }}>{PRODUCT_SUBCATEGORIES[category as ProductCategory].map((item) => <option key={item}>{item}</option>)}</select></label>}
              <label>Product Name <span aria-hidden="true">*</span><input value={productName} maxLength={160} onChange={(event) => setProductName(event.target.value)} placeholder="Enter product name" /></label>
              <label>Price (ZAR) <span aria-hidden="true">*</span><ManualNumberInput mode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Enter price" /></label>
              {category === "Edibles" && <><label>THC per Unit (mg) <span aria-hidden="true">*</span><ManualNumberInput mode="decimal" value={thcPerUnitMg} onChange={(event) => setThcPerUnitMg(event.target.value)} /></label><label>THC per Pack (mg) <span aria-hidden="true">*</span><ManualNumberInput mode="decimal" value={thcPerPacketMg} onChange={(event) => setThcPerPacketMg(event.target.value)} /></label></>}
            </div>
          </div>}
          <div className={styles.supplierGroup}>
            <div className={styles.selectionRow}><label>Supplier <span aria-hidden="true">*</span><select value={selectedSupplier?.id ?? ""} disabled={!supplierSubtype} onChange={(event) => setSupplierId(event.target.value)}><option value="">Select supplier</option>{availableSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><button type="button" className={styles.secondary} disabled={!supplierSubtype} onClick={() => setSupplierDialog(true)}><Plus />New Supplier</button></div>
            <div className={styles.supplierMeta}>
              {supplierSubtype && !availableSuppliers.length && <p className={styles.muted}>No active suppliers for this product type.</p>}
              <label className={styles.unitCost}>Supplier Unit Cost (ZAR) <span aria-hidden="true">*</span><ManualNumberInput mode="decimal" value={supplierUnitCost} onChange={(event) => setSupplierUnitCost(event.target.value)} placeholder="Enter unit cost" /></label>
            </div>
          </div>
        </section>
        <section className={`${styles.section} ${styles.quantity}`}><h2><span className={styles.step}>3</span>Add Stock Quantity</h2><div className={styles.quantityRow}>
          <label>Quantity to Add <span aria-hidden="true">*</span><span className={styles.inputShell}><ManualNumberInput mode="integer" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Enter quantity" aria-describedby="stock-quantity-help" /><span>{category === "Flower" ? "g" : "units"}</span></span><small id="stock-quantity-help">Amount of stock to add.</small>{quantity && !validQuantity && <small className={styles.error}>Enter a positive whole number.</small>}</label>
          <div className={styles.total} aria-live="polite"><strong>New Total Stock</strong><p><span>{formatStockQuantity(currentStock, category)}</span><ArrowRight /><span>{total !== null ? formatStockQuantity(total, category) : "--"}</span></p><small>Current + Quantity</small></div>
        </div></section>
        <div className={`${styles.section} ${styles.quality}`}><ShieldCheck /><div><h3>Quality &amp; Accuracy</h3><p>All stock updates are recorded.</p></div></div>
        <div className={`${styles.section} ${styles.picture}`}><ImagePlus /><div><h3>Add Product Picture <span>(optional)</span></h3><p>Save without a picture to use the default product image.</p>
          <input ref={imageInput} form="manager-add-stock" name="productImage" type="file" accept="image/png,image/jpeg,image/webp" className={styles.file} onChange={(event) => chooseImage(event.target.files?.[0])} />
          <div className={styles.pictureActions}><button type="button" disabled={showCreate && classification} onClick={() => imageInput.current?.click()}><Upload />{imagePreview || savedImage ? "Change Picture" : "Add Product Picture"}</button>{(imagePreview || savedImage) && <button type="button" title="Remove picture" aria-label="Remove picture" onClick={() => clearPicture(!imagePreview && Boolean(savedImage))}><Trash2 /></button>}</div>
          {showCreate && classification && <p>New Flower and Pre-Rolls products use the default category image.</p>}
          {imageError && <p role="alert" className={styles.error}>{imageError}</p>}
        </div></div>
        <div className={styles.previewColumn}>
          <section className={`${styles.section} ${styles.preview}`} aria-labelledby="stock-preview-heading"><h2 id="stock-preview-heading">Product Preview</h2>
            {category ? <div className={styles.previewContent}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImage} alt={previewAlt} className={styles.productImage} />
              <div className={styles.previewDetails}><span className={styles.badge}>{category}</span><h3>{previewName}</h3><dl>
                {classification && cultivationType && <div><dt>Cultivation Type</dt><dd>{cultivationType}</dd></div>}
                {classification && subcategory && <div><dt>Strain Type</dt><dd>{subcategory}</dd></div>}
                {!classification && selectedSubtype && <div><dt>Product Type</dt><dd>{selectedSubtype}</dd></div>}
                <div><dt>Supplier</dt><dd>{selectedSupplier?.name || "Not selected"}</dd></div><div><dt>Current Stock</dt><dd>{formatStockQuantity(currentStock, category)}</dd></div>
                {validQuantity && <div><dt>Quantity to Add</dt><dd>{formatStockQuantity(Number(quantity), category)}</dd></div>}
                {money(supplierUnitCost) && <div><dt>Unit Cost</dt><dd>R {Number(supplierUnitCost).toFixed(2)}</dd></div>}
                {total !== null && <div><dt>New Total Stock</dt><dd>{formatStockQuantity(total, category)}</dd></div>}
              </dl></div>
            </div> : <div className={styles.empty}><PackagePlus size={44} /><strong>No category selected</strong><p>Select a category to see preview</p></div>}
          </section>
          {actions}
        </div>
      </fieldset>
    </div>
    {supplierDialog && supplierCategory && <SupplierRegistration category={supplierCategory} subcategory={supplierSubtype} onClose={() => setSupplierDialog(false)} onSaved={(supplier) => { setLocalSuppliers((current) => [...current.filter((item) => item.id !== supplier.id), supplier]); setSupplierId(supplier.id); setSupplierDialog(false); }} />}
  </div>;
}

function SupplierRegistration({ category: initialCategory, subcategory: initialSubcategory, onClose, onSaved }: { category: string; subcategory: string; onClose: () => void; onSaved: (supplier: AddStockSupplier) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [category, setCategory] = useState<ProductCategory | "">(isProductCategory(initialCategory) ? initialCategory : "");
  const [subcategory, setSubcategory] = useState(initialSubcategory);
  const selectableCategories = useMemo(() => category && !SUPPLIER_CATEGORIES.includes(category as never) ? [...SUPPLIER_CATEGORIES, category] : [...SUPPLIER_CATEGORIES], [category]);
  const [state, action, pending] = useActionState<AddStockSupplierState, FormData>(async (previous, form) => {
    const result = await registerAddStockSupplier(previous, form);
    if (result.ok && result.supplier) onSaved(result.supplier);
    return result;
  }, { ok: false, message: "" });
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className={styles.dialog} onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
    <form action={action}><div className={styles.creationTitle}><h2>New Supplier</h2><button type="button" onClick={onClose} disabled={pending} aria-label="Close supplier registration"><X /></button></div>
      <fieldset disabled={pending} className={styles.fields}>
        <label>Supplier Name <span aria-hidden="true">*</span><input name="name" required minLength={2} maxLength={160} autoFocus /></label><label>Contact Person<input name="contactPerson" maxLength={160} /></label>
        <label>Category <span aria-hidden="true">*</span><select name="category" value={category} onChange={(event) => { setCategory(event.target.value as ProductCategory | ""); setSubcategory(""); }} required><option value="">Select category</option>{selectableCategories.map((item) => <option key={item} value={item}>{supplierCategoryLabel(item)}</option>)}</select></label>
        <label>Subcategory <span aria-hidden="true">*</span><select name="subcategory" value={subcategory} onChange={(event) => setSubcategory(event.target.value)} disabled={!category} required><option value="">Select subcategory</option>{category ? supplierSubcategories(category).map((item) => <option key={item} value={item}>{item}</option>) : null}</select></label>
        <label>Phone<input name="phone" type="tel" maxLength={40} /></label><label>Email<input name="email" type="email" maxLength={254} /></label>
      </fieldset>
      {state.message && <p role="alert" className={styles.error}>{state.message}</p>}<button className={styles.submit} disabled={pending}>{pending ? <PendingSpinner /> : <Plus />}{pending ? "Saving..." : "Register Supplier"}</button>
    </form>
  </dialog>;
}
