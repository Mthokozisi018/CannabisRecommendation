"use client";

import { Fragment, useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive, ArrowLeft, Boxes, Building2, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign,
  Clock3, Edit3, FileText, Mail, MapPin, Package, Phone, Plus, Save, Search, Store,
  Tag, Trash2, Truck, Upload, UserRound, X
} from "lucide-react";
import { archiveSupplierAction, saveSupplierAction, loadManagerSupplierProfile, type SupplierActionState } from "@/app/dashboard/manager/suppliers/actions";
import { SupplyHistoryOverview } from "@/components/manager/SupplyHistoryOverview";
import type { SupplyReport } from "@/lib/manager/supply-report";
import { groupedTableStyles } from "@/components/manager/grouped-table-styles";
import { isProductCategory, type ProductCategory } from "@/lib/manager/options";
import { SUPPLIER_CATEGORIES, supplierCategoryLabel, supplierSubcategories } from "@/lib/manager/supplier-options";
import type { SupplierSummary, SupplyHistoryEntry } from "@/lib/manager/suppliers";
import { groupSupplyHistory, supplyDate, supplyMonth, supplyPeriodLabel, SUPPLY_TIME_ZONE } from "@/lib/manager/supply-history";
import styles from "./SupplierManagement.module.css";

type MappingDraft = { id: string; category: ProductCategory | ""; subcategory: string };
type DetailTab = "products" | "history" | "information";
const initialActionState: SupplierActionState = { ok: false, message: "" };

function money(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

function detailMoney(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(value);
}

function date(value: string | null, withTime = false) {
  if (!value) return "No supplies yet.";
  return withTime ? `${supplyDate(value)}, ${new Intl.DateTimeFormat("en-ZA", { timeZone: SUPPLY_TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(value))}` : supplyDate(value);
}

function categories(supplier: SupplierSummary) {
  return [...new Set(supplier.categories.map((mapping) => supplierCategoryLabel(mapping.category)))];
}

function Badge({ children, tone = "green" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`] ?? ""}`}>{children}</span>;
}

export function SupplierManagement({ initialReport, canRequestSupply = false }: { storeName: string; managerName: string; initialReport: SupplyReport; canRequestSupply?: boolean }) {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(initialReport.filters.month);
  useEffect(() => {
    const update = () => setCurrentMonth(supplyMonth(new Date()));
    update(); const timer = window.setInterval(update, 30_000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);
  const [viewing, setViewing] = useState<{ supplier: SupplierSummary; history: SupplyHistoryEntry[] } | null>(null);
  const [editing, setEditing] = useState<SupplierSummary | null | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const profileRequest = useRef(0);
  async function viewSupplier(id: string) {
    const request = ++profileRequest.current;
    setNotice("Loading supplier profile…");
    try {
      const result = await loadManagerSupplierProfile(id);
      if (request !== profileRequest.current) return;
      if (!result.ok) { setNotice(result.message); return; }
      setViewing({ supplier: result.supplier, history: result.history }); setNotice("");
    } catch { if (request === profileRequest.current) setNotice("The supplier profile could not be loaded. Please retry."); }
  }
  return <main className={styles.page}>
    <div className={styles.shell}>
      <section className={styles.intro}>
        <div className={styles.introControls}>
          <a href="/dashboard/manager" className={styles.backButton}><ArrowLeft size={16} /> Back</a>
          {canRequestSupply ? <div className={styles.supplyActions}>
            <Link href="/dashboard/manager/suppliers/requests" className={styles.supplyButton}><Clock3 size={18} /> View Supply Requests</Link>
            <Link href="/dashboard/manager/suppliers/requests/new" className={`${styles.supplyButton} ${styles.supplyPrimary}`}><Plus size={18} /> Send Supply Request</Link>
          </div> : null}
        </div>
        <div className={styles.introTop}>
          <h1 className={styles.supplierHeading} aria-label="Supplier Management"><svg className={styles.supplierHeadingArt} viewBox="30 160 2110 420" aria-hidden="true"><image href="/images/manager/supplier-management-heading.png" width="2172" height="724" /></svg></h1>
        </div>
      </section>
      {notice && <div className={styles.notice} role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
      <SupplyHistoryOverview initialReport={initialReport} onRegister={() => setEditing(null)} onViewSupplier={id => void viewSupplier(id)} />
    </div>
    {viewing && <SupplierDetails supplier={viewing.supplier} currentMonth={currentMonth} history={viewing.history} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing.supplier); setViewing(null); }} />}
    {editing !== undefined && <SupplierEditor supplier={editing} onClose={() => setEditing(undefined)} onSaved={message => { setEditing(undefined); setNotice(message); router.refresh(); }} />}
  </main>;
}

export function SupplierTransactions({ history }: { history: SupplyHistoryEntry[] }) {
  const transactions = groupSupplyHistory(history, null);
  return <div className="overflow-x-auto"><table className={groupedTableStyles.itemTable} aria-label="Original supply transactions">
    <thead><tr className={groupedTableStyles.itemHeader}>{["Supply Date", "Products", "Categories", "Quantity", "Total Cost", "Recorded By"].map((label) => <th key={label} className="border-2 border-[#405347] p-3">{label}</th>)}</tr></thead>
    <tbody>{transactions.length ? transactions.flatMap((transaction) => transaction.entries.map((entry, index) => <tr key={entry.id} className={groupedTableStyles.itemRow}>
      {index === 0 ? <td rowSpan={transaction.entries.length} className="border-2 border-[#28362d] p-3">{date(transaction.receivedAt, true)}</td> : null}
      <td className="border-2 border-[#28362d] p-3 font-bold">{entry.productName}</td>
      <td className="border-2 border-[#28362d] p-3"><Badge>{supplierCategoryLabel(entry.category)}</Badge></td>
      <td className="border-2 border-[#28362d] p-3 text-right">{entry.quantity.toLocaleString("en-ZA")} {entry.unit}</td>
      {index === 0 ? <><td rowSpan={transaction.entries.length} className="border-2 border-[#28362d] p-3 text-right font-black text-[#9ee57d]">{detailMoney(transaction.totalCost)}</td><td rowSpan={transaction.entries.length} className="border-2 border-[#28362d] p-3">{entry.recordedBy}</td></> : null}
    </tr>)) : <tr className={groupedTableStyles.itemRow}><td colSpan={6} className="border-2 border-[#28362d] p-3 text-white/60">No supplies yet</td></tr>}</tbody>
  </table></div>;
}

function SupplierDetails({ supplier, history, currentMonth, onClose, onEdit }: { supplier: SupplierSummary; history: SupplyHistoryEntry[]; currentMonth: string; onClose: () => void; onEdit: () => void }) {
  const [tab, setTab] = useState<DetailTab>("products");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const products = supplier.products.filter((product) => (!query || product.name.toLowerCase().includes(query.toLowerCase())) && (!category || product.category === category));
  const rows = tab === "products" ? products : history;
  const pages = Math.max(1, Math.ceil(rows.length / 5));
  const start = (page - 1) * 5;
  return <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Supplier details">
    <article className={`${styles.modal} ${styles.detailModal}`}>
      <header className={styles.modalHeader}><span><Store size={22} /></span><div><h2>Supplier Details</h2><p>View supplier information, products supplied and stock history.</p></div><div className={styles.modalHeaderActions}><button className={styles.headerAction} onClick={onEdit}><Edit3 size={16} /> Edit</button><button onClick={onClose} aria-label="Close"><X /></button></div></header>
      <div className={styles.detailBody}>
        <div className={styles.detailTop}>
          <section className={styles.supplierHero}>
            <Logo supplier={supplier} />
            <div className={styles.supplierIdentityText}><h3>{supplier.name}</h3><Badge>{supplier.status === "active" ? "Active" : "Inactive"}</Badge></div>
          </section>
          <section className={styles.detailStats}>
            <Summary icon={Tag} label="Categories Supplied"><div className={styles.badges}>{categories(supplier).map((item, i) => <Badge key={item} tone={i % 2 ? "purple" : "green"}>{item}</Badge>)}</div></Summary>
            <Summary icon={Package} label="Total Products"><strong>{supplier.products.length}</strong><small>Different products supplied</small></Summary>
            <Summary icon={Boxes} label="Total Stock Supplied"><strong>{supplier.totalStockSupplied.toLocaleString("en-ZA")}</strong><small>Units across all products</small></Summary>
          </section>
        </div>
        <nav className={styles.tabs}><button className={tab === "products" ? styles.tabActive : ""} onClick={() => { setTab("products"); setPage(1); }}><Package /> Products Supplied</button><button className={tab === "history" ? styles.tabActive : ""} onClick={() => { setTab("history"); setPage(1); }}><Clock3 /> Stock History</button><button className={tab === "information" ? styles.tabActive : ""} onClick={() => { setTab("information"); setPage(1); }}><FileText /> Supplier Information</button></nav>
        <section className={styles.tabPanel}>
          {tab === "products" ? <><div className={styles.tabHeading}><div><h3>Products Supplied ({supplier.products.length})</h3><p>Products from this supplier and current stock levels.</p></div><div className={styles.miniFilters}><label><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search products..." /></label><select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="">All Categories</option>{categories(supplier).map((item) => <option key={item}>{item}</option>)}</select></div></div><ProductTable products={products.slice(start, start + 5)} /></> : null}
          {tab === "history" ? <><div className={styles.tabHeading}><div><h3>Stock History ({history.length})</h3><p>Current-month deliveries are listed individually. Expand a completed month to see its original receipts.</p></div></div><HistoryTable history={history} currentMonth={currentMonth} /></> : null}
          {tab === "information" ? <SupplierInformation supplier={supplier} /> : null}
          {tab === "products" && rows.length > 5 ? <Pager page={page} pages={pages} onPage={setPage} total={rows.length} start={start} /> : null}
        </section>
      </div>
    </article>
  </div>;
}

function Logo({ supplier }: { supplier: SupplierSummary }) {
  return <div className={styles.logo}>{supplier.logoUrl ? <Image src={supplier.logoUrl} alt={`${supplier.name} logo`} width={96} height={96} unoptimized /> : <Store size={45} />}</div>;
}
function InfoLine({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string | null }) {
  return <div className={styles.infoLine}><Icon size={17} /><span><small>{label}</small><strong>{value || "Not provided"}</strong></span></div>;
}
function Summary({ icon: Icon, label, children }: { icon: typeof Tag; label: string; children: React.ReactNode }) {
  return <article className={styles.summary}><Icon /><div><h4>{label}</h4>{children}</div></article>;
}
function ProductTable({ products }: { products: SupplierSummary["products"] }) {
  if (!products.length) return <div className={styles.empty}>No supplied products recorded yet. Products appear here after stock is received.</div>;
  return <div className={styles.tableWrap}><table className={`${styles.table} ${styles.productTable}`}><thead><tr><th>#</th><th>Product Name</th><th>Category</th><th>Subcategory</th><th>Strain Type</th><th>Cultivation Type</th><th>Current Stock</th></tr></thead><tbody>{products.map((product, index) => <tr key={product.id}><td>{index + 1}</td><td><div className={styles.productName}>{product.imageUrl ? <Image src={product.imageUrl} alt="" width={28} height={28} unoptimized /> : <Package />}<strong>{product.name}</strong></div></td><td><Badge>{product.category}</Badge></td><td>{product.subcategory}</td><td>{product.strainType || "-"}</td><td>{product.cultivationType || "-"}</td><td>{product.currentStock.toLocaleString("en-ZA")}</td></tr>)}</tbody></table></div>;
}
function HistoryTable({ history, currentMonth }: { history: SupplyHistoryEntry[]; currentMonth: string }) {
  const rows = useMemo(() => groupSupplyHistory(history, currentMonth), [history, currentMonth]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / 5));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * 5;
  if (!history.length) return <div className={styles.empty}>No stock receipts are recorded for this supplier yet.</div>;
  return <>
    <div className={styles.tableWrap}><table className={`${styles.table} ${styles.historyTable}`} aria-label="Supply History">
      <thead><tr><th>Date / Period</th><th>Supplier</th><th>Items / Supplies</th><th>Quantity</th><th>Total Cost</th><th>Details</th></tr></thead>
      <tbody>{rows.slice(start, start + 5).map((row) => {
        const open = expanded.has(row.id);
        const label = row.kind === "month" ? supplyPeriodLabel(row.period) : date(row.receivedAt, true);
        const detailsId = `supply-history-${encodeURIComponent(row.id)}`;
        const toggle = () => setExpanded((previous) => { const next = new Set(previous); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; });
        return <Fragment key={row.id}>
          <tr className={row.kind === "month" ? styles.monthSummary : undefined} onClick={toggle}>
            <td><strong>{label}</strong></td><td>{row.supplierName}</td>
            <td>{row.kind === "month" ? `${row.supplies} ${row.supplies === 1 ? "supply" : "supplies"}` : [...new Set(row.entries.map((entry) => entry.productName))].join(", ")}</td>
            <td>{row.quantities.map((item) => <div key={item.unit}>{item.quantity.toLocaleString("en-ZA")} {item.unit}</div>)}</td>
            <td>{detailMoney(row.totalCost)}</td>
            <td><button type="button" className={styles.historyToggle} aria-expanded={open} aria-controls={detailsId} aria-label={`${open ? "Collapse" : "Expand"} ${label} supply records`} onClick={(event) => { event.stopPropagation(); toggle(); }}><ChevronDown size={16} className={open ? "rotate-180" : ""} />{open ? "Hide records" : "View records"}</button></td>
          </tr>
          {open ? <tr id={detailsId}><td colSpan={6}><table className={`${styles.table} ${styles.historyRecords}`} aria-label={`${label} original supply records`}><thead><tr><th>Date</th><th>Reference</th><th>Product</th><th>Quantity</th><th>Unit Cost</th><th>Total</th><th>Recorded By</th></tr></thead><tbody>{row.entries.map((entry) => <tr key={entry.id}><td>{date(entry.receivedAt, true)}</td><td>{entry.reference}</td><td><strong>{entry.productName}</strong><div>{entry.category} / {entry.subcategory}</div></td><td>{entry.quantity.toLocaleString("en-ZA")} {entry.unit}</td><td>{detailMoney(entry.unitCost)}</td><td>{detailMoney(entry.lineTotal)}</td><td>{entry.recordedBy}</td></tr>)}</tbody></table></td></tr> : null}
        </Fragment>;
      })}</tbody>
    </table></div>
    {rows.length > 5 ? <Pager page={safePage} pages={pages} onPage={setPage} total={rows.length} start={start} /> : null}
  </>;
}
function SupplierInformation({ supplier }: { supplier: SupplierSummary }) {
  return <div className={styles.informationGrid}><section><h3>Contact Information</h3><InfoLine icon={UserRound} label="Contact Person" value={supplier.contactPerson} /><InfoLine icon={Phone} label="Phone Number" value={supplier.phone} /><InfoLine icon={Mail} label="Email Address" value={supplier.email} /></section><section><h3>Address</h3><InfoLine icon={MapPin} label="Street Address" value={supplier.streetAddress || supplier.address} /><InfoLine icon={Building2} label="Suburb / City" value={[supplier.suburb, supplier.city].filter(Boolean).join(", ") || null} /><InfoLine icon={Tag} label="Postal Code" value={supplier.postalCode} /></section><section><h3>Terms</h3><InfoLine icon={CircleDollarSign} label="Payment Terms" value={supplier.paymentTerms} /><InfoLine icon={Truck} label="Delivery Time" value={supplier.deliveryTimeDays ? `${supplier.deliveryTimeDays} days` : null} /><InfoLine icon={Package} label="Minimum Order" value={supplier.minimumOrderAmount === null ? null : money(supplier.minimumOrderAmount)} /></section><section><h3>Notes</h3><p>{supplier.notes || "No additional notes."}</p></section></div>;
}

function SupplierEditor({ supplier, onClose, onSaved }: { supplier: SupplierSummary | null; onClose: () => void; onSaved: (message: string) => void }) {
  const [mappings, setMappings] = useState<MappingDraft[]>(supplier?.categories.length ? supplier.categories.map((mapping) => ({ id: mapping.id, category: isProductCategory(mapping.category) ? mapping.category : "", subcategory: mapping.subcategory })) : [{ id: crypto.randomUUID(), category: "", subcategory: "" }]);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archivePending, startArchive] = useTransition();
  const [state, action, pending] = useActionState(async (previous: SupplierActionState, formData: FormData) => {
    const result = await saveSupplierAction(previous, formData);
    if (result.ok) onSaved(result.message);
    return result;
  }, initialActionState);
  function archive() {
    if (!supplier) return;
    startArchive(async () => { const result = await archiveSupplierAction(supplier.id); if (result.ok) onSaved(result.message); });
  }
  return <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={supplier ? "Edit supplier" : "Register supplier"}>
    <article className={`${styles.modal} ${styles.editorModal}`}>
      <header className={styles.modalHeader}><span><Store size={23} /></span><div><h2>{supplier ? "Edit Supplier" : "Register Supplier"}</h2><p>{supplier ? "Update supplier information, categories supplied and contact details." : "Register a supplier and connect their categories to this store."}</p></div><button onClick={onClose} aria-label="Close"><X /></button></header>
      <form action={action} className={styles.form}>
        <input type="hidden" name="supplierId" value={supplier?.id ?? ""} /><input type="hidden" name="existingLogoPath" value={supplier?.logoPath ?? ""} /><input type="hidden" name="categories" value={JSON.stringify(mappings)} /><input type="hidden" name="address" value={supplier?.address ?? ""} />
        <div className={styles.identityFields}><div className={styles.logoEditor}><Logo supplier={supplier ?? ({ name: "Supplier", logoUrl: null } as SupplierSummary)} /><label><Upload size={15} /> {supplier?.logoUrl ? "Change Logo" : "Add Logo"}<input type="file" name="logo" accept="image/jpeg,image/png,image/webp" /></label></div><div><Field label="Supplier Name" name="name" defaultValue={supplier?.name ?? ""} required /><label className={styles.field}><span>Status *</span><select name="status" defaultValue={supplier?.status ?? "active"}><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div></div>
        <div className={styles.formGrid}>
          <FormSection icon={Phone} title="Contact Information"><Field label="Contact Person" name="contactPerson" defaultValue={supplier?.contactPerson ?? ""} required /><Field label="Phone Number" name="phone" type="tel" defaultValue={supplier?.phone ?? ""} required /><Field label="Email Address" name="email" type="email" defaultValue={supplier?.email ?? ""} required /></FormSection>
          <FormSection icon={MapPin} title="Address"><Field label="Street Address" name="streetAddress" defaultValue={supplier?.streetAddress ?? supplier?.address ?? ""} required /><Field label="Suburb" name="suburb" defaultValue={supplier?.suburb ?? ""} /><div className={styles.split}><Field label="City" name="city" defaultValue={supplier?.city ?? ""} required /><Field label="Postal Code" name="postalCode" defaultValue={supplier?.postalCode ?? ""} required /></div></FormSection>
          <FormSection icon={Tag} title="Categories Supplied" subtitle="Select the categories and subcategories this supplier provides."><div className={styles.mappingList}>{mappings.map((mapping, index) => <div className={styles.mapping} key={mapping.id}><select aria-label="Category" value={mapping.category} required onChange={(event) => setMappings((items) => items.map((item, i) => i === index ? { ...item, category: event.target.value as ProductCategory, subcategory: "" } : item))}><option value="">Select category</option>{SUPPLIER_CATEGORIES.map((item) => <option key={item} value={item}>{supplierCategoryLabel(item)}</option>)}</select><select aria-label="Subcategory" value={mapping.subcategory} required disabled={!mapping.category} onChange={(event) => setMappings((items) => items.map((item, i) => i === index ? { ...item, subcategory: event.target.value } : item))}><option value="">Select subcategory</option>{mapping.category ? supplierSubcategories(mapping.category).map((item) => <option key={item}>{item}</option>) : null}</select><button type="button" disabled={mappings.length === 1} onClick={() => setMappings((items) => items.filter((_, i) => i !== index))} aria-label="Remove category"><X size={16} /></button></div>)}</div><button type="button" className={styles.addMapping} onClick={() => setMappings((items) => [...items, { id: crypto.randomUUID(), category: "", subcategory: "" }])}><Plus size={16} /> Add category</button></FormSection>
        </div>
        {state.message ? <p className={state.ok ? styles.success : styles.error} role="status">{state.message}</p> : null}
        <footer className={styles.formFooter}>{supplier ? <button type="button" className={styles.danger} onClick={() => setConfirmArchive(true)}><Trash2 size={17} /> Delete Supplier</button> : <span />}<div><button type="button" className={styles.cancel} onClick={onClose}>Cancel</button><button disabled={pending} className={styles.primary}><Save size={17} /> {pending ? "Saving..." : supplier ? "Save Changes" : "Register Supplier"}</button></div></footer>
      </form>
      {confirmArchive ? <div className={styles.confirm}><div><Archive size={28} /><h3>Archive {supplier?.name}?</h3><p>The supplier will become inactive. Products, stock history, inventory transactions, and previous supply records will be preserved.</p><div><button onClick={() => setConfirmArchive(false)} className={styles.cancel}>Cancel</button><button onClick={archive} disabled={archivePending} className={styles.danger}>{archivePending ? "Archiving..." : "Archive Supplier"}</button></div></div></div> : null}
    </article>
  </div>;
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) { return <label className={styles.field}><span>{label}{props.required ? " *" : ""}</span><input {...props} /></label>; }
function FormSection({ icon: Icon, title, subtitle, children }: { icon: typeof Phone; title: string; subtitle?: string; children: React.ReactNode }) { return <section className={styles.formSection}><header><Icon /><div><h3>{title}</h3>{subtitle ? <p>{subtitle}</p> : null}</div></header>{children}</section>; }
function Pager({ page, pages, onPage, total, start }: { page: number; pages: number; onPage: (page: number) => void; total: number; start: number }) { return <div className={styles.pagination}><div><button disabled={page === 1} onClick={() => onPage(page - 1)}><ChevronLeft /></button>{Array.from({ length: pages }, (_, index) => <button key={index} className={page === index + 1 ? styles.activePage : ""} onClick={() => onPage(index + 1)}>{index + 1}</button>)}<button disabled={page === pages} onClick={() => onPage(page + 1)}><ChevronRight /></button></div><p>Showing {start + 1}-{Math.min(start + 5, total)} of {total}</p></div>; }
