"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Boxes, CalendarDays, ChevronDown, ChevronRight, ClipboardList, FileText, MapPin, PackageCheck, PackageOpen, Search, Truck, Warehouse, ShoppingCart } from "lucide-react";
import { FRANCHISE_STORE_IMAGE } from "@/lib/franchise/types";
import type { SupplySnapshot } from "@/lib/master-supply/data";
import { supplyOverviewMetrics, type SupplyPeriod, type StoreSupplyRow } from "@/lib/master-supply/overview-metrics";
import { BASE, number, Pager } from "./shared";
import styles from "./MasterSupply.module.css";

type StoreFilter = "all" | "active" | "inactive" | "pending" | "requests";
const periodLabels: Record<SupplyPeriod,string> = { day:"This Day", week:"This Week", month:"This Month", year:"This Year" };

function Change({ value, previous }: { value:number; previous:number }) {
  if (previous===0) return <span className={styles.kpiContext}>{value>0?"New activity":"No activity last period"}</span>;
  const change = Math.round((value-previous)/previous*100);
  return <span className={`${styles.kpiChange} ${change<0?styles.kpiDown:""}`}>{change<0?<ArrowDown size={15} fill="currentColor"/>:<ArrowUp size={15} fill="currentColor"/>}{change>0?"+":""}{change}% <span>vs last period</span></span>;
}

function StoreRow({ row }: { row:StoreSupplyRow }) {
  const location = [row.store.city,row.store.province].filter(Boolean).join(", ") || "—";
  return <tr>
    <td><div className={styles.overviewStore}><Image src={row.store.store_image_url || FRANCHISE_STORE_IMAGE} alt="" width={44} height={44} unoptimized/><span>{row.store.name}</span></div></td>
    <td><span className={styles.overviewLocation}><MapPin size={17}/>{location}</span></td>
    <td className={styles.overviewNumber}>{number(row.received)}</td>
    <td className={styles.overviewNumber}>{number(row.sold)}</td>
    <td className={styles.overviewNumber}>{number(row.remaining)}</td>
    <td><div className={styles.overviewProgress}><div role="progressbar" aria-label={`${row.store.name} supply sold`} aria-valuenow={Math.min(100,row.soldPercent)} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${Math.min(100,row.soldPercent)}%`}}/></div><span>{row.soldPercent}%</span></div></td>
    <td>{row.pendingTransit>0?<span className={`${styles.overviewBadge} ${styles.transitBadge}`}><Truck size={14}/> In Transit{row.pendingTransit>1?` (${row.pendingTransit})`:""}</span>:row.pendingReserved>0?<span className={`${styles.overviewBadge} ${styles.pendingBadge}`}><PackageCheck size={14}/> Pending{row.pendingReserved>1?` (${row.pendingReserved})`:""}</span>:<span className={styles.overviewDash}>—</span>}</td>
    <td>{row.requests>0?<span className={`${styles.overviewBadge} ${styles.requestBadge}`}><ClipboardList size={14}/>{row.requests} {row.requests===1?"Request":"Requests"}</span>:<span className={styles.overviewDash}>—</span>}</td>
    <td><span className={`${styles.overviewBadge} ${row.active?styles.activeBadge:styles.inactiveBadge}`}>{row.active?"Active":"Inactive"}</span></td>
    <td><Link className={styles.overviewView} href={`${BASE}/stores/${row.store.id}` as never}>View Supply Performance <ChevronRight size={16}/></Link></td>
  </tr>;
}

export function SupplyOverview({ snapshot }: { snapshot: SupplySnapshot }) {
  const [period,setPeriod] = useState<SupplyPeriod>("month");
  const [search,setSearch] = useState("");
  const [storeFilter,setStoreFilter] = useState<StoreFilter>("all");
  const [page,setPage] = useState(0);
  const metrics = useMemo(()=>supplyOverviewMetrics(snapshot,period),[snapshot,period]);
  const rows = metrics.rows.filter(r=>{
    const matches = `${r.store.name} ${r.store.city??""} ${r.store.province??""}`.toLowerCase().includes(search.toLowerCase().trim());
    return matches && (storeFilter==="all" || storeFilter==="active"&&r.active || storeFilter==="inactive"&&!r.active || storeFilter==="pending"&&(r.pendingReserved+r.pendingTransit)>0 || storeFilter==="requests"&&r.requests>0);
  });
  const kpis = [
    { label:"Total Supply Received", value:metrics.current.received, previous:metrics.prior.received, icon:PackageOpen },
    { label:"Master Inventory", value:metrics.masterInventory, icon:Warehouse },
    { label:"Total Supply Distributed", value:metrics.current.distributed, previous:metrics.prior.distributed, icon:Truck },
    { label:"Total Supply Sold", value:metrics.current.sold, previous:metrics.prior.sold, icon:ShoppingCart },
    { label:"Remaining Store Inventory", value:metrics.remaining, icon:Boxes }
  ];
  const links = [
    { label:"View Master Inventory", description:"View central stock and product details.", view:"inventory", icon:PackageCheck, tone:styles.navGreen },
    { label:"Distribute Supply", description:"Send stock to franchise stores.", view:"distribute", icon:Truck, tone:styles.navBlue },
    { label:"Distribution History", description:"View all store distributions.", view:"history", icon:FileText, tone:styles.navPurple },
    { label:"Supply Requests", description:"Review and manage store requests.", view:"requests", icon:ClipboardList, tone:styles.navOrange }
  ];
  return <div className={styles.overview}>
    <header className={styles.overviewHeader}><Link className={`${styles.back} ${styles.overviewBack}`} href={"/dashboard/franchise" as never}><ArrowLeft size={17}/> Back</Link><div className={styles.overviewTitle}><h1 aria-label="Master Supply Management"><svg className={styles.overviewTitleArt} viewBox="0 205 2172 310" aria-hidden="true"><image href="/images/franchise/master-supply-management-heading.png" width="2172" height="724" /></svg></h1><p>Manage franchise stock, distribution and store supply performance.</p></div><label className={styles.periodSelect}><CalendarDays size={23}/><select aria-label="Dashboard period" value={period} onChange={e=>{setPeriod(e.target.value as SupplyPeriod);setPage(0);}}>{Object.entries(periodLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><ChevronDown size={18}/></label></header>
    <section className={styles.overviewKpis} aria-label="Supply summary">{kpis.map(kpi=><div className={styles.overviewKpi} key={kpi.label}><span className={styles.kpiIcon}><kpi.icon size={38} strokeWidth={2.5}/></span><div className={styles.kpiBody}><div className={styles.kpiLabel}>{kpi.label}</div><strong>{number(kpi.value)}</strong><div className={styles.kpiUnit}>Products</div><div className={styles.kpiFoot}>{kpi.previous===undefined?<span className={styles.kpiContext}>Current balance</span>:<Change value={kpi.value} previous={kpi.previous}/>}</div></div></div>)}</section>
    <nav className={styles.overviewNav} aria-label="Master Supply actions">{links.map(link=><Link href={`${BASE}/${link.view}` as never} key={link.view} className={`${styles.overviewNavCard} ${link.tone}`}><span className={styles.navIcon}><link.icon size={42} strokeWidth={2.3}/></span><span className={styles.navCopy}><strong>{link.label}{link.view==="requests"&&metrics.outstandingRequests>0?<span className={styles.requestCount}>{number(metrics.outstandingRequests)}</span>:null}</strong><small>{link.description}</small></span><ArrowRight className={styles.navArrow} size={25}/></Link>)}</nav>
    <section className={styles.overviewPanel}><div className={styles.overviewPanelHead}><div><h2>Franchise Store Supply Overview</h2><p>View supply distribution, inventory and sales performance for each store.</p></div><div className={styles.overviewFilters}><label className={styles.overviewSearch}><Search size={21}/><input aria-label="Search stores" placeholder="Search stores..." value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/></label><label className={styles.overviewFilter}><select aria-label="Filter stores" value={storeFilter} onChange={e=>{setStoreFilter(e.target.value as StoreFilter);setPage(0);}}><option value="all">All Stores</option><option value="active">Active Stores</option><option value="inactive">Inactive Stores</option><option value="pending">Pending Distributions</option><option value="requests">Outstanding Requests</option></select><ChevronDown size={18}/></label></div></div>
      <div className={styles.overviewTableWrap}><table className={styles.overviewTable}><thead><tr>{["Store Name","Location","Supply Received","Supply Sold","Remaining","Sold %","Pending Distributions","Recent Requests","Status","Actions"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{rows.slice(page*10,page*10+10).map(row=><StoreRow row={row} key={row.store.id}/>)}</tbody></table>{rows.length===0?<p className={styles.overviewEmpty}>{snapshot.stores.length===0?"No franchise stores have been registered yet.":"No stores match your search or filter."}</p>:null}</div>{rows.length>10?<Pager page={page} setPage={setPage} count={rows.length}/>:null}
    </section>
  </div>;
}
