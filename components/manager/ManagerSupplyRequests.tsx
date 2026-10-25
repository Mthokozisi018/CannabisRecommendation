"use client";

import { Fragment, startTransition, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Plus, RefreshCw } from "lucide-react";
import { masterSupplyAction } from "@/app/dashboard/franchise/supply/actions";
import { ProductLabel, stamp, number } from "@/components/master-supply/shared";
import { filterSupplyProducts, SUPPLY_CATEGORIES, supplyCategoryFor, supplySubcategories, type SupplyCategory } from "@/lib/master-supply/product-filters";
import { PRODUCT_CATEGORY_PARAMETERS, isProductCategory } from "@/lib/manager/options";
import { displaySubcategory, subcategoryKey } from "@/components/receptionist/pos/pos-helpers";
import { getCategoryPlaceholder } from "@/lib/product-images";
import { managerRequestStatus, REQUEST_QUANTITY_LIMIT, type CatalogueProduct, type ManagerSupplyRequestsData } from "@/lib/manager/supply-request-model";
import styles from "./ManagerSupplyRequests.module.css";

const BASE = "/dashboard/manager/suppliers/requests";
const labels: Record<string,string> = { pending:"Pending", approved:"Approved", partially_approved:"Partially Approved", rejected:"Rejected", in_distribution:"In Distribution", fulfilled:"Fulfilled", partially_fulfilled:"Partially Fulfilled" };
function RequestStatus({ value }: { value:string }) {
  return <span className={`${styles.badge} ${styles[value] ?? ""}`}>{labels[value] ?? value.replaceAll("_", " ")}</span>;
}

function useStoreRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = window.setInterval(refresh, 20_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  },[router]);
  return router;
}

export function ManagerSupplyRequests({ data }: { data:ManagerSupplyRequestsData }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const router = useStoreRefresh();
  const products = new Map(data.products.map(product => [product.id,product]));
  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.heading}><div><Link className={styles.button} href="/dashboard/manager/suppliers"><ArrowLeft size={17}/> Back to Suppliers</Link><h1>Supply Requests</h1><p>{data.context.store_name} · {data.context.franchise_name}</p></div>
      <div className={styles.actions}><button className={styles.button} onClick={() => router.refresh()}><RefreshCw size={17}/> Refresh</button><Link href={`${BASE}/new`} className={`${styles.button} ${styles.primary}`}><Plus size={18}/> Send Supply Request</Link><Link className={styles.button} href="/dashboard/manager/supply">Deliveries &amp; Receipts</Link></div></header>
    <section className={styles.panel} aria-label="Store supply requests"><div className={styles.tableWrap}><table className={`${styles.table} ${styles.requestTable}`}><thead><tr>{["Date","Products","Requested Units","Status","Action"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>
      {data.requests.map(request => { const distributions = data.distributions.filter(row => row.request_id === request.id); return <Fragment key={request.id}>
        <tr><td data-label="Date">{stamp(request.created_at)}</td><td data-label="Products">{request.master_supply_request_items.length} products</td><td data-label="Requested Units">{number(request.master_supply_request_items.reduce((sum,item) => sum+item.requested_quantity,0))}</td><td data-label="Status"><RequestStatus value={managerRequestStatus(request,data.distributions)}/></td><td data-label="Action"><button className={styles.button} aria-expanded={expanded === request.id} aria-controls={`request-${request.id}`} onClick={() => setExpanded(expanded === request.id ? null : request.id)}>{expanded === request.id ? "Close" : "View"}</button></td></tr>
        {expanded === request.id ? <tr className={styles.detailsRow}><td colSpan={5}><div id={`request-${request.id}`} className={styles.details}><h2>Requested products</h2>
          <p className={styles.muted}>Submitted {stamp(request.created_at)} · Reviewed {stamp(request.reviewed_at)}</p>
          <table className={styles.table}><thead><tr><th scope="col">Product</th><th scope="col">Requested</th><th scope="col">Approved</th></tr></thead><tbody>{request.master_supply_request_items.map(item => <tr key={item.product_id}><td><ProductLabel product={products.get(item.product_id)}/></td><td>{number(item.requested_quantity)}</td><td>{item.approved_quantity === null ? "Awaiting review" : number(item.approved_quantity)}</td></tr>)}</tbody></table>
          {request.notes ? <p className={styles.muted}>Your notes: {request.notes}</p> : null}
          {request.rejection_reason ? <p className={styles.error}>Rejection reason: {request.rejection_reason}</p> : null}
          {distributions.map(distribution => <div key={distribution.id}><h2>Distribution {distribution.id.slice(0,8).toUpperCase()}</h2><p className={styles.muted}>{distribution.status.replaceAll("_"," ")} · {distribution.delivery_method === "collection" ? "Collection" : "Standard delivery"} · Created {stamp(distribution.created_at)} · Received {stamp(distribution.received_at)}</p>{distribution.master_supply_distribution_items.map(item => <p key={item.product_id}>{products.get(item.product_id)?.name ?? "Product"}: sent {number(item.quantity)} · received {item.received_quantity === null ? "Awaiting receipt" : number(item.received_quantity)}</p>)}</div>)}
        </div></td></tr> : null}
      </Fragment>; })}
    </tbody></table></div>{!data.requests.length ? <p className={styles.muted}>No supply requests have been submitted for this store.</p> : null}</section>
  </div></main>;
}

function CatalogueCard({ product, selected, onAdd }: { product:CatalogueProduct; selected?:number; onAdd:(quantity:number) => void }) {
  const [quantity, setQuantity] = useState("1");
  const [image, setImage] = useState(product.image_url || getCategoryPlaceholder(product.category));
  const amount = Number(quantity);
  return <article className={styles.card}>
    <Image src={image} alt={`${product.name} product image`} width={96} height={112} unoptimized onError={() => setImage(getCategoryPlaceholder(product.category))}/>
    <div><h2>{product.name}</h2><p>{product.category}{product.subcategory ? ` · ${displaySubcategory(product.subcategory)}` : ""}</p>
      <p>{[product.cultivation_type,product.strain_type].filter(Boolean).join(" · ")}</p>
      <span className={`${styles.badge} ${product.available ? styles.available : styles.unavailable}`}>{product.available ? "Available" : "Unavailable"}</span>
      <label>Request Quantity<input aria-label={`Request quantity for ${product.name}`} type="number" min="1" max={REQUEST_QUANTITY_LIMIT} step="1" value={quantity} disabled={!product.available} onChange={event => setQuantity(event.target.value)}/></label>
      <button className={`${styles.button} ${styles.primary}`} disabled={!product.available || !Number.isInteger(amount) || amount < 1 || amount > REQUEST_QUANTITY_LIMIT} onClick={() => onAdd(amount)}>{selected ? "Update Request" : "Add to Request"}</button>
      {selected ? <p role="status">{number(selected)} selected</p> : null}
    </div>
  </article>;
}

export function ManagerSupplyRequestForm({ data }: { data:ManagerSupplyRequestsData }) {
  const [step, setStep] = useState<"products" | "review" | "success">("products");
  const [amounts, setAmounts] = useState<Record<string,string>>({});
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<SupplyCategory>(() => SUPPLY_CATEGORIES.find(c => data.products.some(p => supplyCategoryFor(p.category) === c.category))?.category ?? "Flower");
  const [subcategory, setSubcategory] = useState("");
  const [cultivation, setCultivation] = useState("");
  const [strain, setStrain] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = useRef<string | null>(null);
  const submitting = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const selected = data.products.filter(product => product.id in amounts).map(product => ({ product, quantity:Number(amounts[product.id]) }));
  const valid = selected.length > 0 && selected.length <= 100 && selected.every(item => item.product.available && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= REQUEST_QUANTITY_LIMIT);
  const subcategories = supplySubcategories(data.products,category);
  const categoryProducts = data.products.filter(product => supplyCategoryFor(product.category) === category && (!subcategory || subcategoryKey(product.subcategory) === subcategoryKey(subcategory)));
  const cultivations = category === "Flower" ? [...new Set(categoryProducts.map(product => product.cultivation_type).filter((value):value is string => Boolean(value)))] : [];
  const usesStrain = isProductCategory(category) && PRODUCT_CATEGORY_PARAMETERS[category].usesStrainType;
  const strains = usesStrain ? [...new Set(categoryProducts.filter(product => !cultivation || product.cultivation_type === cultivation).map(product => product.strain_type || product.subcategory).filter(Boolean))] : [];
  const visible = filterSupplyProducts(data.products,{ category, subcategory, cultivation, strain, search });
  const pageCount = Math.max(1,Math.ceil(visible.length/8));
  const currentPage = Math.min(page,pageCount-1);
  function remove(productId:string) { setAmounts(previous => { const next = {...previous}; delete next[productId]; return next; }); }
  function selectCategory(value:SupplyCategory) { setCategory(value); setSubcategory(""); setCultivation(""); setStrain(""); setPage(0); }
  async function submit() {
    if (submitting.current || !valid) return;
    submitting.current = true; setBusy(true); setError("");
    id.current ??= crypto.randomUUID();
    try {
      const result = await masterSupplyAction("request", { id:id.current, expectedStoreId:data.context.store_id, notes, items:selected.map(item => ({ productId:item.product.id, quantity:item.quantity })) });
      if (result.ok) { setStep("success"); dialog.current?.close(); router.refresh(); }
      else { setError(result.message); dialog.current?.close(); }
    } catch { setError("Submission could not be confirmed. Retry to check the same request without creating a duplicate."); dialog.current?.close(); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <main className={styles.page}><div className={styles.shell}>
    {step === "success" ? <section className={`${styles.panel} ${styles.success}`} role="status"><CheckCircle2 size={48}/><h1>Supply Request Submitted Successfully</h1><p>Your supply request has been sent to your Franchise Admin for review.</p><Link className={`${styles.button} ${styles.primary}`} href={BASE}>View Supply Requests</Link></section> : <>
      <header className={styles.heading}><div><Link href="/dashboard/manager/suppliers" className={styles.button}><ArrowLeft size={17}/> Back to Suppliers</Link><h1>{step === "review" ? "Review Supply Request" : "Request Supply"}</h1><p>{step === "products" ? "Browse products available from your franchise’s Master Inventory and select the products your store needs." : `${data.context.store_name} · ${data.context.franchise_name}`}</p></div><div className={styles.actions}><button className={styles.button} disabled={busy} onClick={() => router.refresh()}><RefreshCw size={17}/> Refresh Catalogue</button><Link className={styles.button} href={BASE}>View Supply Requests</Link></div></header>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {step === "products" ? <div className={styles.layout}><section aria-label="Master Inventory product catalogue">
        <div className={styles.panel}><nav className={styles.categories} aria-label="Product categories">{SUPPLY_CATEGORIES.filter(option => data.products.some(product => supplyCategoryFor(product.category) === option.category)).map(option => <button key={option.category} className={styles.button} aria-pressed={category === option.category} onClick={() => selectCategory(option.category)}>{option.label}</button>)}</nav>
          <div className={styles.toolbar}><label>Search products<input value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="Name or SKU"/></label>
            {subcategories.length ? <label>Subcategory<select value={subcategory} onChange={event => { setSubcategory(event.target.value); setCultivation(""); setStrain(""); setPage(0); }}><option value="">All subcategories</option>{subcategories.map(value => <option key={value} value={value}>{displaySubcategory(value)}</option>)}</select></label> : null}
            {cultivations.length ? <label>Cultivation Type<select value={cultivation} onChange={event => { setCultivation(event.target.value); setStrain(""); setPage(0); }}><option value="">All cultivation types</option>{cultivations.map(value => <option key={value}>{value}</option>)}</select></label> : null}
            {strains.length ? <label>Strain Type<select value={strain} onChange={event => { setStrain(event.target.value); setPage(0); }}><option value="">All strains</option>{strains.map(value => <option key={value}>{value}</option>)}</select></label> : null}
          </div><p className={styles.muted}>Availability can change. Requests do not reserve stock; your Franchise Admin can approve the full request, approve it partially or reject it.</p>
        </div>
        <div className={styles.catalogue}>{visible.slice(currentPage*8,(currentPage+1)*8).map(product => <CatalogueCard key={product.id} product={product} selected={Number(amounts[product.id]) || undefined} onAdd={quantity => setAmounts(previous => ({...previous,[product.id]:String(quantity)}))}/>)}</div>
        {!visible.length ? <p className={styles.panel}>No products match these filters.</p> : null}
        <div className={styles.toolbar}><button className={styles.button} disabled={currentPage === 0} onClick={() => setPage(currentPage-1)}>Previous</button><span className={styles.muted}>Page {currentPage+1} of {pageCount}</span><button className={styles.button} disabled={currentPage+1 >= pageCount} onClick={() => setPage(currentPage+1)}>Next</button></div>
      </section><section className={`${styles.panel} ${styles.basket}`} aria-label="Selected products"><h2>Your Request</h2><p className={styles.muted}>{data.context.store_name}</p>
        {selected.map(item => <div className={styles.basketItem} key={item.product.id}><strong>{item.product.name}</strong><label>Quantity<input type="number" min="1" max={REQUEST_QUANTITY_LIMIT} step="1" aria-label={`Selected quantity for ${item.product.name}`} value={amounts[item.product.id]} onChange={event => setAmounts(previous => ({...previous,[item.product.id]:event.target.value}))}/></label><button className={styles.button} aria-label={`Remove ${item.product.name}`} onClick={() => remove(item.product.id)}>Remove</button></div>)}
        {!selected.length ? <p className={styles.muted}>Add products from the catalogue to begin.</p> : null}
        {selected.length && !valid ? <p className={styles.error}>Select up to 100 available products with positive whole quantities.</p> : null}
        <label htmlFor="manager-supply-notes">Optional manager notes</label><textarea id="manager-supply-notes" maxLength={500} rows={3} value={notes} onChange={event => setNotes(event.target.value)}/>
        <button className={`${styles.button} ${styles.primary}`} disabled={!valid} onClick={() => { setError(""); setStep("review"); }}>Review Supply Request</button>
      </section></div> : <section className={styles.panel}><h2>{data.context.store_name}</h2><p className={styles.muted}>{data.context.franchise_name}</p>
        {selected.map(item => <div className={styles.summaryItem} key={item.product.id}><div><ProductLabel product={item.product}/><p className={styles.muted}>{item.product.category}</p></div><strong>{number(item.quantity)} requested</strong></div>)}
        <p className={styles.muted}>Manager notes: {notes || "None"}</p><div className={styles.actions}><button className={styles.button} disabled={busy} onClick={() => setStep("products")}>Back to Products</button><button className={`${styles.button} ${styles.primary}`} disabled={!valid || busy} onClick={() => dialog.current?.showModal()}>Submit Supply Request</button></div>
      </section>}
    </>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="submit-request-title" onCancel={event => { if (busy) event.preventDefault(); }}><h2 id="submit-request-title">Confirm supply request</h2><p>Send {selected.length} products to {data.context.franchise_name} for {data.context.store_name}? This does not reserve stock.</p><div className={styles.actions}><button className={styles.button} disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button><button className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={() => startTransition(submit)}>{busy ? "Submitting…" : "Confirm Submission"}</button></div></dialog>
  </div></main>;
}
