"use client";

import { useEffect, useRef, useState } from "react";
import { Boxes, Leaf, ShoppingBag, Syringe } from "lucide-react";
import type { MasterProduct } from "@/lib/master-supply/data";
import { CULTIVATION_TYPES, PRODUCT_CATEGORY_BUTTON_ORDER, PRODUCT_SUBCATEGORIES, VAPE_PRODUCT_TYPES, VAPE_STRAIN_TYPES } from "@/lib/manager/options";
import { masterSupplySku } from "@/lib/master-supply/sku";
import { Notice, ProductLabel, useSupplyMutation } from "./shared";
import styles from "./MasterSupply.module.css";

type Category = (typeof PRODUCT_CATEGORY_BUTTON_ORDER)[number];
type Draft = { name: string; supplierCostPrice: string; price: string; quantity: string };
const icons: Record<Category, typeof Leaf> = { Flower: Leaf, "Pre-Rolls": Syringe, Edibles: ShoppingBag, Accessories: ShoppingBag, "Vape Cartridges": Boxes };
const normalize = (value: string | null | undefined) => (value ?? "").trim().toLocaleLowerCase();

export function MasterSupplyAddForm({ products, franchiseId, onSaved, onClose }: {
  products: MasterProduct[];
  franchiseId: string;
  onSaved: (product: MasterProduct, quantity: number, isNew: boolean) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<Category | "">("");
  const [subcategory, setSubcategory] = useState("");
  const [cultivationType, setCultivationType] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [productId, setProductId] = useState("");
  const [draft, setDraft] = useState<Draft>({ name: "", supplierCostPrice: "", price: "", quantity: "" });
  const [imageFile,setImageFile]=useState<File|null>(null);
  const [imagePreviewUrl,setImagePreviewUrl]=useState("");
  const imageInput=useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState("");
  const submitting = useRef(false);
  const mutationId = useRef(crypto.randomUUID());
  const mutation = useSupplyMutation();
  useEffect(()=>()=>{if(imagePreviewUrl)URL.revokeObjectURL(imagePreviewUrl);},[imagePreviewUrl]);
  const showVape = category === "Vape Cartridges";
  const showCultivation = category === "Flower" || category === "Pre-Rolls";
  const showStrain = showCultivation || showVape;
  const subcategories = category ? (showVape ? [...VAPE_PRODUCT_TYPES] : [...PRODUCT_SUBCATEGORIES[category]]) : [];
  const detailsReady = Boolean(category && subcategory && (!showStrain || cultivationType));
  const matches = detailsReady ? products.filter(product => {
    if (showVape) {
      return (product.category === "Vape Cartridges" && product.subcategory === subcategory && (product.cultivation_type === cultivationType || (!product.cultivation_type && product.strain_type === cultivationType)))
        || (product.category === (subcategory === "Disposable Vape" ? "Disposable Vapes" : "Vape Cartridges") && product.subcategory === cultivationType && !product.cultivation_type);
    }
    return product.category === category && product.subcategory === subcategory && (!showCultivation || product.cultivation_type === cultivationType);
  }) : [];
  const selected = matches.find(product => product.id === productId);
  const quantity = Number(draft.quantity);
  const validQuantity = Number.isInteger(quantity) && quantity >= 1 && quantity <= 1_000_000;
  const preview: MasterProduct | null = category ? (mode === "existing" && selected ? selected : {
    id: "preview", franchise_id: franchiseId, sku: mode === "existing" ? "Select a product" : "SKU generated on save", name: mode === "existing" ? "Select a product" : draft.name || "Product name",
    category, subcategory, strain_type: showCultivation ? subcategory : showVape ? cultivationType : null,
    cultivation_type: showStrain ? cultivationType : null, price: Number(draft.price) || 0,
    supplier_cost_price: Number(draft.supplierCostPrice)||null,
    image_url: mode === "new" ? imagePreviewUrl||null : null,
    description: "", on_hand: 0, reserved: 0, total_received: 0, last_received_at: null, created_at: ""
  }) : null;

  function selectCategory(next: Category) {
    setCategory(next); setSubcategory(""); setCultivationType(""); setProductId(""); setFormError("");
  }
  function update(key: keyof Draft, value: string) { setDraft(current => ({ ...current, [key]: value })); setFormError(""); }
  function selectImage(file:File|null){
    setFormError("");
    if(file && (!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>6*1024*1024||file.size===0)) {
      setFormError("Choose a JPG, PNG, or WebP image up to 6MB.");
      if(imageInput.current)imageInput.current.value="";
      return;
    }
    setImageFile(file);
    setImagePreviewUrl(file?URL.createObjectURL(file):"");
    if(!file&&imageInput.current)imageInput.current.value="";
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setFormError("");
    if (!detailsReady) { setFormError("Choose a category and all applicable product details."); return; }
    if (!validQuantity) { setFormError("Enter a positive whole-number quantity, up to 1,000,000."); return; }
    if (mode === "existing" && !selected) { setFormError("Select an existing product to receive supply."); return; }
    if (mode === "new") {
      if (draft.name.trim().length < 2) { setFormError("Enter a product name with at least two characters."); return; }
      if (draft.supplierCostPrice.trim() === "" || !Number.isFinite(Number(draft.supplierCostPrice)) || Number(draft.supplierCostPrice) <= 0) { setFormError("Enter a supplier cost price greater than zero."); return; }
      if (draft.price.trim() === "" || !Number.isFinite(Number(draft.price)) || Number(draft.price) <= 0) { setFormError("Enter a store price greater than zero."); return; }
      const duplicate = matches.find(product => normalize(product.name) === normalize(draft.name));
      if (duplicate) { setFormError(`${duplicate.name} already exists as SKU ${duplicate.sku}. Select Existing Product to add supply.`); return; }
    }
    submitting.current = true;
    try {
      const payload=new FormData();
      if(mode==="new"){
        payload.set("id",mutationId.current);payload.set("name",draft.name.trim());payload.set("category",category);
        payload.set("subcategory",subcategory);payload.set("strainType",showCultivation?subcategory:showVape?cultivationType:"");
        payload.set("cultivationType",showStrain?cultivationType:"");payload.set("supplierCostPrice",draft.supplierCostPrice);
        payload.set("price",draft.price);payload.set("quantity",draft.quantity);
        if(imageFile)payload.set("productImage",imageFile);
      }
      const result = mode === "existing" && selected
        ? await mutation.run("add_stock", { id: mutationId.current, productId: selected.id, quantity, reason: "Central stock received" })
        : await mutation.run("create_product",payload);
      if (!result.ok) return;
      const product = mode === "existing" && selected ? selected : { ...preview!, id: result.id, sku: result.sku??masterSupplySku(category,result.id), name: draft.name.trim(), price: Number(draft.price), supplier_cost_price:Number(draft.supplierCostPrice), image_url: result.imageUrl??null };
      onSaved(product, quantity, mode === "new");
      onClose();
    } finally { submitting.current = false; }
  }

  return <form onSubmit={submit} className={styles.addSupplyForm}>
    <section className={styles.addSupplySection} aria-label="Product category">
      <h3>1. Select Category</h3>
      <div className={styles.addSupplyCategories}>{PRODUCT_CATEGORY_BUTTON_ORDER.map(option => {
        const Icon = icons[option];
        return <button key={option} type="button" className={`${styles.addSupplyCategory} ${category === option ? styles.addSupplyCategoryActive : ""}`} aria-pressed={category === option} onClick={() => selectCategory(option)}><Icon size={19} aria-hidden="true" />{option}</button>;
      })}</div>
    </section>
    {category ? <>
      <section className={styles.addSupplySection} aria-label="Product details">
        <h3>2. Product Details</h3>
        <div className={styles.formGrid}>
          <div className={styles.field}><label htmlFor="supply-subcategory">{category === "Flower" || category === "Pre-Rolls" ? "Strain Type" : category === "Edibles" ? "Edible Type" : category === "Accessories" ? "Accessory Type" : "Subcategory"}</label><select id="supply-subcategory" value={subcategory} onChange={event => { setSubcategory(event.target.value); setProductId(""); }} required><option value="">Select a type</option>{subcategories.map(value => <option key={value} value={value}>{value}</option>)}</select></div>
          {showStrain ? <div className={styles.field}><label htmlFor="supply-cultivation">{showVape ? "Vape Strain" : "Cultivation Type"}</label><select id="supply-cultivation" value={cultivationType} onChange={event => { setCultivationType(event.target.value); setProductId(""); }} required><option value="">Select {showVape ? "strain" : "cultivation"}</option>{(showVape ? VAPE_STRAIN_TYPES : CULTIVATION_TYPES).map(value => <option key={value}>{value}</option>)}</select></div> : null}
        </div>
      </section>
      <section className={styles.addSupplySection} aria-label="Product selection">
        <h3>3. Select Product</h3>
        <div className={styles.addSupplyModes}><button type="button" className={`${styles.button} ${mode === "existing" ? styles.primary : ""}`} aria-pressed={mode === "existing"} onClick={() => { setMode("existing"); setFormError(""); }}>Select Existing Product</button><button type="button" className={`${styles.button} ${mode === "new" ? styles.primary : ""}`} aria-pressed={mode === "new"} onClick={() => { setMode("new"); setFormError(""); }}>Add New Product</button></div>
        {mode === "existing" ? <div className={styles.field}><label htmlFor="supply-product">Existing Product</label><select id="supply-product" value={productId} onChange={event => setProductId(event.target.value)} disabled={!detailsReady} required><option value="">Select a product</option>{matches.map(product => <option key={product.id} value={product.id}>{product.name} · {product.sku} ({product.on_hand - product.reserved} available)</option>)}</select>{detailsReady && !matches.length ? <small className={styles.muted}>No matching products. Choose Add New Product to register one.</small> : null}</div> : <>
          <div className={styles.formGrid}>
            <div className={styles.field}><label htmlFor="supply-name">Product Name</label><input id="supply-name" value={draft.name} onChange={event => update("name", event.target.value)} minLength={2} maxLength={120} required /></div>
            <div className={styles.field}><label htmlFor="supply-cost">Supplier Cost Price (ZAR)</label><div className={styles.addSupplyMoney}><span>R</span><input id="supply-cost" type="number" min="0.01" step="0.01" value={draft.supplierCostPrice} onChange={event => update("supplierCostPrice", event.target.value)} required /></div></div>
            <div className={styles.field}><label htmlFor="supply-price">Store Selling Price (ZAR)</label><div className={styles.addSupplyMoney}><span>R</span><input id="supply-price" type="number" min="0.01" step="0.01" value={draft.price} onChange={event => update("price", event.target.value)} required /></div></div>
          </div>
          <div className={styles.field}><label htmlFor="supply-image">Product Image (Optional)</label><input ref={imageInput} id="supply-image" className={styles.addSupplyFileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>selectImage(event.target.files?.[0]??null)}/><div className={styles.inline}><button type="button" className={styles.button} onClick={()=>imageInput.current?.click()}>{imageFile?"Replace Image":"Upload Image"}</button>{imageFile?<button type="button" className={styles.button} onClick={()=>selectImage(null)}>Remove Image</button>:null}</div>{imageFile?<small className={styles.muted}>{imageFile.name}</small>:null}</div>
        </>}
      </section>
      <section className={styles.addSupplySection} aria-label="Product preview"><h3>Product Preview</h3>{preview ? <><ProductLabel product={preview} /><p className={styles.muted}>{[category, subcategory, showStrain ? cultivationType : ""].filter(Boolean).join(" · ")}</p>{mode === "new" && draft.supplierCostPrice ? <p className={styles.muted}>Supplier cost: R {Number(draft.supplierCostPrice).toFixed(2)}</p> : null}{mode === "new" && draft.price ? <p className={styles.muted}>Store selling price: R {Number(draft.price).toFixed(2)}</p> : null}{selected && mode === "existing" ? <p className={styles.muted}>Current: {selected.on_hand} · After supply: {validQuantity ? selected.on_hand + quantity : selected.on_hand}</p> : null}</> : null}</section>
      <div className={styles.field}><label htmlFor="supply-quantity">{category === "Flower" ? "Quantity Received (g)" : "Quantity Received (units)"}</label><input id="supply-quantity" type="number" min="1" max="1000000" step="1" value={draft.quantity} onChange={event => update("quantity", event.target.value)} required /></div>
    </> : null}
    <Notice message={formError} error /><Notice message={mutation.message} error={mutation.error} />
    <div className={styles.inline}><button type="submit" className={`${styles.button} ${styles.primary}`} disabled={mutation.busy || !detailsReady || !validQuantity || (mode === "existing" && !selected)}>Add Supply</button><button type="button" className={styles.button} onClick={onClose}>Cancel</button></div>
  </form>;
}
