"use client";

import { useMemo, useRef, useState } from "react";
import { Candy, Flower2, Gem, ShoppingBag, Sprout, Wind } from "lucide-react";
import type { MasterProduct, SupplySnapshot } from "@/lib/master-supply/data";
import { CULTIVATION_TYPES, PRODUCT_CATEGORIES, PRODUCT_SUBCATEGORIES, VAPE_STRAIN_TYPES } from "@/lib/manager/options";
import { displaySubcategory, subcategoryKey } from "@/components/receptionist/pos/pos-helpers";
import { filterSupplyProducts, SUPPLY_CATEGORIES, supplyCategoryFor, supplySubcategories, type SupplyCategory } from "@/lib/master-supply/product-filters";
import { number, Notice, Pager, ProductLabel, stamp, useSupplyMutation } from "./shared";
import styles from "./MasterSupply.module.css";

const empty = { sku:"",name:"",category:"Flower",subcategory:"",strainType:"",cultivationType:"",price:"0",imageUrl:"",description:"",quantity:"1" };
const inventoryKpis = SUPPLY_CATEGORIES.map((item,index)=>({
  ...item,
  icon:[Flower2,Sprout,Candy,ShoppingBag,Gem,Wind][index],
  tone:["inventoryKpiFlower","inventoryKpiPreRolls","inventoryKpiEdibles","inventoryKpiAccessories","inventoryKpiConcentrates","inventoryKpiVapes"][index],
}));

export function SupplyInventory({ snapshot }: { snapshot: SupplySnapshot }) {
  const [search,setSearch]=useState(""); const [category,setCategory]=useState<SupplyCategory>("Flower"); const [subcategory,setSubcategory]=useState("");
  const [kpiCategory,setKpiCategory]=useState<SupplyCategory|null>(null);
  const [strain,setStrain]=useState(""); const [cultivation,setCultivation]=useState(""); const [page,setPage]=useState(0);
  const [modal,setModal]=useState<"new"|"stock"|"adjust"|"view"|null>(null); const [selected,setSelected]=useState<MasterProduct|null>(null);
  const demoDistributed=selected&&snapshot.demo?snapshot.distributions.filter(distribution=>["in_transit","delivered","discrepancy"].includes(distribution.status)).reduce((sum,distribution)=>sum+distribution.master_supply_distribution_items.filter(item=>item.product_id===selected.id).reduce((amount,item)=>amount+item.quantity,0),0):0;
  const [draft,setDraft]=useState(empty); const [stockQty,setStockQty]=useState("1");
  const [formError,setFormError]=useState("");
  const [delta,setDelta]=useState("-1"); const [adjustReason,setAdjustReason]=useState("");
  const mutationId=useRef(crypto.randomUUID());
  const mutation=useSupplyMutation();
  const availableByCategory=useMemo(()=>{
    const totals=new Map<string,number>();
    for(const product of snapshot.products){
      const key=supplyCategoryFor(product.category);
      totals.set(key,(totals.get(key)??0)+Math.max(0,product.on_hand-product.reserved));
    }
    return totals;
  },[snapshot.products]);
  const subcategories=useMemo(()=>supplySubcategories(snapshot.products,category),[snapshot.products,category]);
  const effectiveSubcategory=subcategories.some(value=>subcategoryKey(value)===subcategoryKey(subcategory))?subcategory:"";
  const showStrain=category==="Flower"||category==="Pre-Rolls";
  const showCultivation=category==="Flower";
  const products=useMemo(()=>filterSupplyProducts(snapshot.products,{category,search,subcategory:effectiveSubcategory,strain,cultivation}),[snapshot.products,search,category,effectiveSubcategory,strain,cultivation]);
  const selectCategory=(next:SupplyCategory,fromKpi=false)=>{
    setCategory(next);setKpiCategory(fromKpi?next:null);setSubcategory("");setStrain("");setCultivation("");setPage(0);
  };
  const reset=()=>{setSearch("");selectCategory("Flower");};
  const update=(key:keyof typeof empty,value:string)=>setDraft(d=>({...d,[key]:value}));
  async function submitNew(event:React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const matchingDetails=(p:MasterProduct)=>p.name.toLowerCase()===draft.name.trim().toLowerCase() && p.category===draft.category && p.subcategory.toLowerCase()===draft.subcategory.trim().toLowerCase() && (p.strain_type??"").toLowerCase()===draft.strainType.trim().toLowerCase() && (p.cultivation_type??"").toLowerCase()===draft.cultivationType.toLowerCase();
    const existing=snapshot.products.find(p=>p.sku.toLowerCase()===draft.sku.trim().toLowerCase());
    if (existing && !matchingDetails(existing)) { setFormError(`SKU ${existing.sku} belongs to another product. Open that product to add stock.`); return; }
    const duplicate=snapshot.products.find(p=>matchingDetails(p));
    if (!existing && duplicate) { setFormError(`This product already exists as SKU ${duplicate.sku}. Use its Add Stock action.`); return; }
    const result=existing ? await mutation.run("add_stock",{id:mutationId.current,productId:existing.id,quantity:Number(draft.quantity),reason:"Central stock received"}) : await mutation.run("create_product",{
      id:mutationId.current,sku:draft.sku.trim(),name:draft.name.trim(),category:draft.category,subcategory:draft.subcategory.trim(),strainType:draft.strainType.trim(),cultivationType:draft.cultivationType,price:Number(draft.price),imageUrl:draft.imageUrl.trim(),description:draft.description.trim(),quantity:Number(draft.quantity)
    });
    if(result.ok){setModal(null);setDraft(empty);setFormError("");mutationId.current=crypto.randomUUID();}
  }
  async function submitStock(event:React.FormEvent) {event.preventDefault();if(!selected)return;const result=await mutation.run("add_stock",{id:mutationId.current,productId:selected.id,quantity:Number(stockQty),reason:"Central stock received"});if(result.ok){setModal(null);mutationId.current=crypto.randomUUID();}}
  async function submitAdjustment(event:React.FormEvent) {event.preventDefault();if(!selected)return;const result=await mutation.run("adjust_central",{id:mutationId.current,productId:selected.id,delta:Number(delta),reason:adjustReason});if(result.ok){setModal(null);mutationId.current=crypto.randomUUID();}}
  return <>
    <section className={styles.panel}>
      <div className={styles.inventoryKpis} role="group" aria-label="Central stock by category">
        {inventoryKpis.map(({category:kpiKey,label,icon:Icon,tone})=><button
          key={kpiKey}
          type="button"
          className={`${styles.inventoryKpi} ${styles[tone]}`}
          aria-pressed={kpiCategory===kpiKey}
          aria-label={`${label}: ${number(availableByCategory.get(kpiKey)??0)} available. ${kpiCategory===kpiKey?"Reset to Flower":"Filter inventory"}`}
          onClick={()=>selectCategory(kpiCategory===kpiKey?"Flower":kpiKey,kpiCategory!==kpiKey)}
        ><span className={styles.inventoryKpiTop}><Icon size={23} strokeWidth={1.9} aria-hidden="true"/><span>{label}</span></span><span className={styles.inventoryKpiValue}><strong>{number(availableByCategory.get(kpiKey)??0)}</strong><span>Available</span></span></button>)}
      </div>
      <div className={styles.toolbar}>
        <input aria-label="Search products" placeholder="Search products…" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} />
        <select aria-label="Category" value={category} onChange={e=>selectCategory(e.target.value as SupplyCategory)}>{SUPPLY_CATEGORIES.map(({category:key,label})=><option key={key} value={key}>{label}</option>)}</select>
        {subcategories.length?<select aria-label="Subcategory" value={effectiveSubcategory} onChange={e=>{setSubcategory(e.target.value);setPage(0);}}><option value="">All Subcategories</option>{subcategories.map(value=><option key={subcategoryKey(value)} value={value}>{displaySubcategory(value)}</option>)}</select>:null}
        {showStrain?<select aria-label="Strain type" value={strain} onChange={e=>{setStrain(e.target.value);setPage(0);}}><option value="">All Strain Types</option>{PRODUCT_SUBCATEGORIES.Flower.map(value=><option key={value}>{value}</option>)}</select>:null}
        {showCultivation?<select aria-label="Cultivation" value={cultivation} onChange={e=>{setCultivation(e.target.value);setPage(0);}}><option value="">All Cultivations</option>{CULTIVATION_TYPES.map(value=><option key={value}>{value}</option>)}</select>:null}
        <button className={styles.button} onClick={reset}>Clear Filters</button>
        <button className={`${styles.button} ${styles.primary}`} onClick={()=>{setDraft(empty);setFormError("");mutationId.current=crypto.randomUUID();setModal("new");mutation.clear();}}>＋ Add Supply</button>
      </div>
      <div className={styles.tableWrap}><table className={styles.table} style={{minWidth:1060}}><thead><tr>{["Product","Category","Subcategory","Strain Type","Cultivation","Current Stock","Last Added","Actions"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{products.slice(page*10,page*10+10).map(p=><tr key={p.id}><td><ProductLabel product={p}/></td><td>{p.category}</td><td>{p.subcategory||"—"}</td><td>{p.strain_type||"—"}</td><td>{p.cultivation_type||"—"}</td><td><span className={styles.badge}>{number(p.on_hand-p.reserved)} available</span>{p.reserved?<small className={styles.muted}> {p.reserved} reserved</small>:null}</td><td>{stamp(p.last_received_at)}</td><td><div className={styles.inline}><button className={styles.button} onClick={()=>{setSelected(p);setModal("view");}}>View</button><button className={styles.button} onClick={()=>{setSelected(p);setStockQty("1");mutationId.current=crypto.randomUUID();setModal("stock");mutation.clear();}}>Add Stock</button></div></td></tr>)}</tbody></table>{!products.length?<p className={styles.empty}>No products match these filters.</p>:null}</div>
      <Pager page={page} setPage={setPage} count={products.length}/>
    </section>
    {modal?<div className={styles.overlay} onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null);}}><div className={styles.dialog} role="dialog" aria-modal="true" aria-label={modal==="new"?"Add supply":modal==="stock"?"Add stock":modal==="adjust"?"Adjust central stock":"Product details"}>
      <div className={styles.heading}><h2>{modal==="new"?"Add Supply":modal==="stock"?`Add Stock · ${selected?.name}`:modal==="adjust"?`Adjust Stock · ${selected?.name}`:selected?.name}</h2><button className={styles.button} onClick={()=>setModal(null)} aria-label="Close">✕</button></div>
      {modal==="new"?<form onSubmit={submitNew}><div className={styles.formGrid}>
        {([ ["sku","SKU"],["name","Product Name"],["subcategory","Subcategory"],["strainType","Strain Type"],["price","Store Price (ZAR)"],["imageUrl","Image URL"],["quantity","Quantity Received"] ] as [keyof typeof empty,string][]).map(([key,label])=><div className={styles.field} key={key}><label htmlFor={`master-${key}`}>{label}</label><input id={`master-${key}`} value={draft[key]} onChange={e=>update(key,e.target.value)} list={key==="subcategory"?"master-subcategories":undefined} type={key==="price"||key==="quantity"?"number":"text"} min={key==="quantity"?1:key==="price"?0:undefined} step={key==="price"?"0.01":"1"} required={["sku","name","quantity","price"].includes(key)}/></div>)}
        <div className={styles.field}><label htmlFor="master-category">Category</label><select id="master-category" value={draft.category} onChange={e=>setDraft(d=>({...d,category:e.target.value,subcategory:"",cultivationType:""}))}>{PRODUCT_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
        {["Flower","Pre-Rolls","Vape Cartridges"].includes(draft.category)?<div className={styles.field}><label htmlFor="master-cultivationType">{draft.category==="Vape Cartridges"?"Vape Strain":"Cultivation"}</label><select id="master-cultivationType" value={draft.cultivationType} onChange={e=>update("cultivationType",e.target.value)} required><option value="">Select {draft.category==="Vape Cartridges"?"vape strain":"cultivation"}</option>{(draft.category==="Vape Cartridges"?VAPE_STRAIN_TYPES:CULTIVATION_TYPES).map(c=><option key={c}>{c}</option>)}</select></div>:null}
        <datalist id="master-subcategories">{PRODUCT_SUBCATEGORIES[draft.category as keyof typeof PRODUCT_SUBCATEGORIES]?.map(c=><option key={c} value={c}/>)}</datalist>
      </div><div className={styles.field}><label htmlFor="master-description">Description</label><textarea id="master-description" value={draft.description} onChange={e=>update("description",e.target.value)}/></div><Notice message={formError} error/><Notice message={mutation.message} error={mutation.error}/><div className={styles.inline}><button type="submit" className={`${styles.button} ${styles.primary}`} disabled={mutation.busy}>Save Supply</button><button type="button" className={styles.button} onClick={()=>setModal(null)}>Cancel</button></div></form>:null}
      {modal==="stock"?<form onSubmit={submitStock}><div className={styles.field}><label htmlFor="add-quantity">Quantity received</label><input id="add-quantity" type="number" min="1" step="1" value={stockQty} onChange={e=>setStockQty(e.target.value)} required/></div><Notice message={mutation.message} error={mutation.error}/><button className={`${styles.button} ${styles.primary}`} disabled={mutation.busy}>Add Stock</button></form>:null}
      {modal==="adjust"?<form onSubmit={submitAdjustment}><p className={styles.muted}>Use a signed quantity: negative for damaged or missing stock, positive for a verified correction. Reserved units cannot be removed.</p><div className={styles.field}><label htmlFor="adjust-delta">Quantity change</label><input id="adjust-delta" type="number" min="-1000000" max="1000000" step="1" value={delta} onChange={e=>setDelta(e.target.value)} required/></div><div className={styles.field}><label htmlFor="adjust-reason">Reason</label><textarea id="adjust-reason" minLength={5} maxLength={500} value={adjustReason} onChange={e=>setAdjustReason(e.target.value)} required/></div><Notice message={mutation.message} error={mutation.error}/><button className={`${styles.button} ${styles.primary}`} disabled={mutation.busy||Number(delta)===0||adjustReason.trim().length<5}>Save Adjustment</button></form>:null}
      {modal==="view"&&selected?<><dl className={styles.detail}><dt>SKU</dt><dd>{selected.sku}</dd><dt>Category</dt><dd>{selected.category} / {selected.subcategory||"—"}</dd><dt>Strain / Cultivation</dt><dd>{selected.strain_type||"—"} / {selected.cultivation_type||"—"}</dd><dt>Current stock</dt><dd>{number(selected.on_hand-selected.reserved)} available, {number(selected.reserved)} reserved</dd><dt>Total received</dt><dd>{number(selected.total_received)}</dd>{snapshot.demo?<><dt>Total distributed</dt><dd>{number(demoDistributed)}</dd></>:null}</dl><button className={styles.button} onClick={()=>{mutationId.current=crypto.randomUUID();setDelta("-1");setAdjustReason("");setModal("adjust");mutation.clear();}}>Adjust Central Stock</button><h3>Receiving history</h3><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Date</th><th>Quantity</th><th>Reason</th></tr></thead><tbody>{snapshot.receipts.filter(r=>r.product_id===selected.id).map(r=><tr key={r.id}><td>{stamp(r.created_at)}</td><td>{r.quantity}</td><td>{r.reason}</td></tr>)}</tbody></table></div><h3>Adjustment history</h3><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Date</th><th>Change</th><th>Before</th><th>After</th><th>Reason</th></tr></thead><tbody>{snapshot.adjustments.filter(a=>a.product_id===selected.id).map(a=><tr key={a.id}><td>{stamp(a.created_at)}</td><td>{a.delta>0?"+":""}{a.delta}</td><td>{a.previous_quantity}</td><td>{a.new_quantity}</td><td>{a.reason}</td></tr>)}</tbody></table></div></>:null}
    </div></div>:null}
  </>;
}
