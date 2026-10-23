"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, ClipboardList, Package, Search, Store, Truck, X } from "lucide-react";
import { displaySubcategory, subcategoryKey } from "@/components/receptionist/pos/pos-helpers";
import { CULTIVATION_TYPES, PRODUCT_SUBCATEGORIES } from "@/lib/manager/options";
import type { MasterProduct, SupplySnapshot } from "@/lib/master-supply/data";
import { filterSupplyProducts, SUPPLY_CATEGORIES, supplySubcategories, type SupplyCategory } from "@/lib/master-supply/product-filters";
import { getPreRollCultivationCardImage, getProductImage } from "@/lib/product-images";
import { BASE, location, Notice, number, useSupplyMutation } from "./shared";
import styles from "./MasterSupply.module.css";

const steps = [
  ["Select Store", "Choose destination store"],
  ["Select Products", "Choose products and quantities"],
  ["Review Distribution", "Confirm and review details"],
  ["Complete", "Finish distribution"],
] as const;

function DistributionProductLabel({ product }: { product: MasterProduct }) {
  const image = getPreRollCultivationCardImage(product) ?? getProductImage(product);
  return <span className={styles.distributionProductLabel}>
    <Image src={image} alt={`${product.name} product image`} width={44} height={44} unoptimized />
    <span><strong>{product.name}</strong><small>{product.sku}</small></span>
  </span>;
}

export function SupplyDistribute({ snapshot, requestId }: { snapshot: SupplySnapshot; requestId?: string }) {
  const request = requestId ? snapshot.requests.find(row => row.id === requestId && ["approved", "partially_approved"].includes(row.status)) : undefined;
  const invalidRequest = Boolean(requestId && !request);
  const [storeId, setStoreId] = useState(request?.store_id ?? "");
  const [delivery, setDelivery] = useState<"standard" | "collection">("standard");
  const [amounts, setAmounts] = useState<Record<string, number>>(() => Object.fromEntries(request?.master_supply_request_items.filter(item => (item.approved_quantity ?? 0) > 0).map(item => [item.product_id, item.approved_quantity ?? 0]) ?? []));
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<SupplyCategory>("Flower");
  const [subcategory, setSubcategory] = useState("");
  const [strain, setStrain] = useState("");
  const [cultivation, setCultivation] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [step, setStep] = useState<"select" | "review" | "complete">("select");
  const [createdId, setCreatedId] = useState("");
  const mutation = useSupplyMutation();
  const distributionId = useRef(crypto.randomUUID());

  const subcategories = useMemo(() => supplySubcategories(snapshot.products, category), [snapshot.products, category]);
  const effectiveSubcategory = subcategories.some(value => subcategoryKey(value) === subcategoryKey(subcategory)) ? subcategory : "";
  const visible = useMemo(() => filterSupplyProducts(snapshot.products, { category, search, subcategory: effectiveSubcategory, strain, cultivation }), [snapshot.products, category, search, effectiveSubcategory, strain, cultivation]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageProducts = visible.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const selected = snapshot.products.filter(product => (amounts[product.id] ?? 0) > 0).map(product => ({ product, quantity: amounts[product.id] }));
  const total = selected.reduce((sum, item) => sum + item.quantity, 0);
  const store = snapshot.stores.find(item => item.id === storeId);
  const requestMax = (productId: string) => request ? request.master_supply_request_items.find(item => item.product_id === productId)?.approved_quantity ?? 0 : Infinity;
  const available = (product: MasterProduct) => Math.max(0, product.on_hand - product.reserved);
  const maxQuantity = (product: MasterProduct) => Math.min(available(product), requestMax(product.id));
  const invalidQuantity = selected.some(item => item.quantity > maxQuantity(item.product));
  const validSelection = Boolean(storeId && selected.length && !invalidRequest && !invalidQuantity);
  const selectablePageProducts = pageProducts.filter(product => maxQuantity(product) > 0);
  const allPageSelected = selectablePageProducts.length > 0 && selectablePageProducts.every(product => (amounts[product.id] ?? 0) > 0);

  const change = (productId: string, value: number) => setAmounts(previous => ({ ...previous, [productId]: Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0 }));
  const selectCategory = (value: SupplyCategory) => { setCategory(value); setSubcategory(""); setStrain(""); setCultivation(""); setPage(0); };
  const clearFilters = () => { setSearch(""); selectCategory("Flower"); };
  const togglePage = () => setAmounts(previous => {
    const next = { ...previous };
    for (const product of selectablePageProducts) next[product.id] = allPageSelected ? 0 : Math.max(1, next[product.id] ?? 0);
    return next;
  });
  const review = () => { mutation.clear(); if (validSelection) setStep("review"); };
  async function confirm() {
    if (!validSelection) return;
    const result = await mutation.run("distribute", {
      id: distributionId.current, storeId, requestId: request?.id ?? null, deliveryMethod: delivery, notes,
      items: selected.map(item => ({ productId: item.product.id, quantity: item.quantity })),
    });
    if (result.ok) { setCreatedId(result.id); setStep("complete"); }
  }

  return <div className={styles.distributionPage}>
    <nav className={styles.distributionSteps} aria-label="Distribution progress">
      {steps.map(([label, description], index) => {
        const current = step === "complete" ? 3 : step === "review" ? 2 : 0;
        return <div className={`${styles.distributionStep} ${index === current ? styles.distributionStepActive : ""}`} key={label} aria-current={index === current ? "step" : undefined}>
          <span className={styles.distributionStepNumber}>{index + 1}</span>
          <span className={styles.distributionStepText}><strong>{label}</strong><small>{description}</small></span>
          {index < steps.length - 1 ? <ChevronRight className={styles.distributionStepArrow} size={21} aria-hidden="true" /> : null}
        </div>;
      })}
    </nav>

    {invalidRequest ? <Notice message="This supply request is no longer eligible for conversion. Return to Supply Requests to review its status." error /> : null}

    {step === "complete" ? <section className={`${styles.panel} ${styles.distributionResult}`}>
      <Package size={33} aria-hidden="true" /><h2>Distribution created</h2>
      <p>Stock is reserved. Dispatch it from Distribution History when it leaves central custody.</p>
      <p className={styles.muted}>Reference: {createdId}</p>
      <Link className={`${styles.button} ${styles.primary}`} href={`${BASE}/history` as never}>View Distribution History <ArrowRight size={17} /></Link>
    </section> : null}

    {step === "review" ? <section className={`${styles.panel} ${styles.distributionReview}`}>
      <div className={styles.distributionPanelTitle}><ClipboardList size={27} aria-hidden="true" /><div><h2>Review Distribution</h2><p>Confirm the destination and quantities before reserving central stock.</p></div></div>
      <dl className={styles.distributionReviewDetails}>
        <dt>Destination</dt><dd>{store?.name} · {store?.city}</dd>
        <dt>Delivery</dt><dd>{delivery === "standard" ? "Standard Distribution" : "Direct Collection"}</dd>
        <dt>Supply request</dt><dd>{request?.id ?? "Direct distribution"}</dd>
        <dt>Notes</dt><dd>{notes || "—"}</dd>
      </dl>
      <div className={styles.tableWrap}><table className={`${styles.table} ${styles.distributionTable}`}><thead><tr><th>Product</th><th>Quantity</th><th>Available</th></tr></thead><tbody>
        {selected.map(item => <tr key={item.product.id}><td><DistributionProductLabel product={item.product} /></td><td>{number(item.quantity)}</td><td>{number(available(item.product))}</td></tr>)}
      </tbody></table></div>
      <p className={styles.distributionReviewTotal}>Total Units <strong>{number(total)}</strong></p>
      {invalidQuantity ? <Notice message="One or more quantities exceed available or approved stock." error /> : null}
      <Notice message={mutation.message} error={mutation.error} />
      <div className={styles.distributionReviewActions}><button className={`${styles.button} ${styles.primary}`} disabled={mutation.busy || !validSelection} onClick={confirm}>Confirm Distribution</button><button className={styles.button} disabled={mutation.busy} onClick={() => setStep("select")}>Back to edit</button></div>
    </section> : null}

    {step === "select" ? <div className={styles.distributionLayout}>
      <div className={styles.distributionMain}>
        <div className={styles.distributionSetup}>
          <section className={`${styles.panel} ${styles.distributionPanel}`}>
            <div className={styles.distributionPanelTitle}><Store size={28} aria-hidden="true" /><h2>Destination Store</h2></div>
            <select className={styles.distributionStoreSelect} aria-label="Destination store" value={storeId} disabled={Boolean(request)} onChange={event => setStoreId(event.target.value)}>
              <option value="">Select a franchise store</option>
              {snapshot.stores.map(item => <option value={item.id} key={item.id}>{item.name}{item.city ? ` - ${item.city}` : ""}</option>)}
            </select>
          </section>
          <section className={`${styles.panel} ${styles.distributionPanel}`}>
            <div className={styles.distributionPanelTitle}><Truck size={28} aria-hidden="true" /><h2>Delivery Details</h2></div>
            <div className={styles.distributionDeliveryOptions}>
              <button type="button" className={`${styles.distributionDeliveryButton} ${delivery === "standard" ? styles.distributionDeliveryActive : ""}`} aria-pressed={delivery === "standard"} onClick={() => setDelivery("standard")}>Standard Distribution</button>
              <button type="button" className={`${styles.distributionDeliveryButton} ${delivery === "collection" ? styles.distributionDeliveryActive : ""}`} aria-pressed={delivery === "collection"} onClick={() => setDelivery("collection")}>Direct Collection</button>
            </div>
          </section>
        </div>

        <section className={`${styles.panel} ${styles.distributionPanel} ${styles.distributionProducts}`}>
          <div className={styles.distributionPanelTitle}><Package size={30} aria-hidden="true" /><div><h2>Select Products</h2><p>Choose products from central stock and enter quantities.</p></div></div>
          <div className={styles.distributionFilters}>
            <label className={styles.distributionSearch}><Search size={19} aria-hidden="true" /><input aria-label="Search products" placeholder="Search products..." value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label>
            <select aria-label="Category" value={category} onChange={event => selectCategory(event.target.value as SupplyCategory)}>{SUPPLY_CATEGORIES.map(item => <option value={item.category} key={item.category}>{item.label}</option>)}</select>
            {subcategories.length ? <select aria-label="Subcategory" value={effectiveSubcategory} onChange={event => { setSubcategory(event.target.value); setPage(0); }}><option value="">All Subcategories</option>{subcategories.map(value => <option value={value} key={subcategoryKey(value)}>{displaySubcategory(value)}</option>)}</select> : null}
            {category === "Flower" || category === "Pre-Rolls" ? <select aria-label="Strain type" value={strain} onChange={event => { setStrain(event.target.value); setPage(0); }}><option value="">All Strain Types</option>{PRODUCT_SUBCATEGORIES.Flower.map(value => <option key={value}>{value}</option>)}</select> : null}
            {category === "Flower" ? <select aria-label="Cultivation" value={cultivation} onChange={event => { setCultivation(event.target.value); setPage(0); }}><option value="">All Cultivations</option>{CULTIVATION_TYPES.map(value => <option key={value}>{value}</option>)}</select> : null}
            <button type="button" className={styles.distributionClearFilters} onClick={clearFilters}>Clear Filters</button>
          </div>
          <div className={styles.tableWrap}><table className={`${styles.table} ${styles.distributionTable}`}><thead><tr>
            <th><input type="checkbox" aria-label="Select all visible products" checked={allPageSelected} disabled={!selectablePageProducts.length} onChange={togglePage} /></th>
            <th>Product</th><th>Category</th><th>Strain Type</th><th>Cultivation</th><th>Available Stock</th><th>Quantity to Distribute</th>
          </tr></thead><tbody>{pageProducts.map(product => {
            const max = maxQuantity(product);
            return <tr key={product.id}>
              <td><input type="checkbox" aria-label={`Select ${product.name}`} checked={(amounts[product.id] ?? 0) > 0} disabled={max <= 0} onChange={event => change(product.id, event.target.checked ? Math.min(1, max) : 0)} /></td>
              <td><DistributionProductLabel product={product} /></td>
              <td>{product.category}</td><td>{product.strain_type || (["Flower", "Pre-Rolls"].includes(product.category) ? product.subcategory : "") || "N/A"}</td><td>{product.cultivation_type || "N/A"}</td>
              <td className={styles.distributionAvailable}>{number(available(product))} units</td>
              <td><input className={styles.distributionQuantity} aria-label={`Quantity for ${product.name}`} type="number" min="0" max={max} step="1" inputMode="numeric" value={amounts[product.id] ?? 0} disabled={max <= 0} onChange={event => change(product.id, Number(event.target.value))} />{request ? <small className={styles.muted}>Max approved {number(requestMax(product.id))}</small> : null}</td>
            </tr>;
          })}</tbody></table>{!visible.length ? <p className={styles.empty}>No products match these filters.</p> : null}</div>
          <div className={styles.distributionPagination}>
            <span>Showing {visible.length ? currentPage * pageSize + 1 : 0} – {Math.min(visible.length, (currentPage + 1) * pageSize)} of {visible.length} products</span>
            <nav aria-label="Product pages"><button aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} /></button>{Array.from({ length: Math.min(pageCount, 5) }, (_, index) => Math.max(0, Math.min(pageCount - 5, currentPage - 2)) + index).map(index => <button key={index} aria-current={index === currentPage ? "page" : undefined} onClick={() => setPage(index)}>{index + 1}</button>)}<button aria-label="Next page" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17} /></button></nav>
            <select aria-label="Products per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(0); }}><option value="5">5 per page</option><option value="10">10 per page</option><option value="20">20 per page</option></select>
          </div>
        </section>
      </div>

      <aside className={`${styles.panel} ${styles.distributionPanel} ${styles.distributionSummary}`}>
        <div className={styles.distributionSummaryHead}><div className={styles.distributionPanelTitle}><ClipboardList size={27} aria-hidden="true" /><h2>Distribution Summary</h2></div><button type="button" className={styles.distributionClearAll} onClick={() => setAmounts({})}>Clear All</button></div>
        <div className={styles.distributionDestination}>{store ? <><strong>{store.name}</strong><small>{location(store)}</small></> : <span>Select a destination store</span>}</div>
        <div className={styles.distributionSelected}>
          <h3><Package size={25} aria-hidden="true" />Selected Products ({selected.length})</h3>
          {selected.length ? <div className={styles.distributionSelectedList}>{selected.map(item => <div className={styles.distributionSelectedItem} key={item.product.id}><DistributionProductLabel product={item.product} /><span>{number(item.quantity)} units</span><button type="button" aria-label={`Remove ${item.product.name}`} onClick={() => change(item.product.id, 0)}><X size={17} /></button></div>)}</div> : <div className={styles.distributionEmpty}><Package size={38} aria-hidden="true" /><strong>No products selected</strong><span>Add products and quantities from the list to see them here.</span></div>}
        </div>
        <p className={styles.distributionTotal}><span>Total Units</span><strong>{number(total)}</strong></p>
        <div className={styles.distributionNotes}><label htmlFor="distribution-notes">Additional Notes (Optional)</label><textarea id="distribution-notes" maxLength={500} value={notes} placeholder="Add any notes for this distribution..." onChange={event => setNotes(event.target.value)} /></div>
        {invalidQuantity ? <Notice message="One or more quantities exceed available or approved stock." error /> : null}
        <Notice message={mutation.message} error={mutation.error} />
        <div className={styles.distributionSummaryActions}><button type="button" className={`${styles.button} ${styles.primary}`} disabled={!validSelection} onClick={review}>Continue to Review <ArrowRight size={17} /></button><Link className={styles.button} href={BASE as never}>Cancel</Link></div>
      </aside>
    </div> : null}
  </div>;
}
