"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SupplySnapshot } from "@/lib/master-supply/data";
import { BASE } from "./shared";
import { SupplyOverview } from "./SupplyOverview";
import { SupplyInventory } from "./SupplyInventory";
import { SupplyDistribute } from "./SupplyDistribute";
import { SupplyRequests } from "./SupplyRequests";
import { SupplyHistory } from "./SupplyHistory";
import { SupplyStoreDetail } from "./SupplyStoreDetail";
import styles from "./MasterSupply.module.css";

export type SupplyMode = "overview" | "inventory" | "distribute" | "requests" | "history" | "store";
const descriptions: Record<SupplyMode,[string,string]> = {
  overview:["Master Supply Management","Track central stock and the supply delivered to franchise stores."],
  inventory:["Master Inventory","View and manage central franchise supply inventory. Add new supply or increase existing stock."],
  distribute:["Distribute Supply","Select a franchise store, choose products and quantities, then review the distribution."],
  requests:["Supply Requests","Review and manage stock requests from franchise stores."],
  history:["Distribution History","View the history of stock distributions from central Master Supply to franchise stores."],
  store:["Supply Performance","Master Supply received and sold at this franchise store."]
};

export function MasterSupplyPage({ mode, snapshot, requestId, storeId }: { mode: SupplyMode; snapshot: SupplySnapshot; requestId?: string; storeId?: string }) {
  const router=useRouter();
  useEffect(()=>{
    if(snapshot.demo) return;
    let client: ReturnType<typeof createSupabaseBrowserClient>;
    try { client=createSupabaseBrowserClient(); } catch { return; }
    let timer:ReturnType<typeof setTimeout>|undefined;
    const changed=()=>{if(document.visibilityState==="visible"){clearTimeout(timer);timer=setTimeout(()=>router.refresh(),250);}};
    const channel=client.channel(`master-supply:${snapshot.franchiseId}`);
    for(const table of ["master_supply_products","master_supply_requests","master_supply_distributions","master_supply_store_stock","master_supply_sale_allocations","master_supply_events"])
      channel.on("postgres_changes",{event:"*",schema:"public",table,filter:`franchise_id=eq.${snapshot.franchiseId}`},changed);
    channel.subscribe();
    document.addEventListener("visibilitychange",changed);
    return ()=>{clearTimeout(timer);document.removeEventListener("visibilitychange",changed);void client.removeChannel(channel);};
  },[router,snapshot.franchiseId,snapshot.demo]);
  const [title,description] = descriptions[mode];
  const artwork = mode==="requests"
    ? {source:"/images/franchise/supply-requests-heading.png",viewBox:"45 162 2080 425"}
    : mode==="history"
      ? {source:"/images/franchise/distribution-history-heading.png",viewBox:"0 175 2172 385"}
      : mode==="inventory"
        ? {source:"/images/franchise/master-inventory-heading.png",viewBox:"0 184 2172 394"}
        : mode==="distribute"
          ? {source:"/images/franchise/distribute-supply-heading.png",viewBox:"0 190 2172 380"}
          : mode==="store"
            ? {source:"/images/franchise/supply-performance-heading.png",viewBox:"0 175 2171 380"}
            : null;
  return <div className={styles.page}>
    {mode==="overview"||artwork?null:<Link className={styles.back} href={BASE as never}>← Back to Master Supply Management</Link>}
    {mode!=="overview"&&mode!=="store"&&!artwork?<div className={styles.heading}><div><h1>{title}</h1><p>{description}</p></div></div>:null}
    {artwork?<header className={`${styles.overviewHeader} ${styles.supplySubpageHero}`}><Link className={`${styles.back} ${styles.overviewBack}`} href={BASE as never}><ArrowLeft size={17}/> Back to Master Supply Management</Link><div className={styles.overviewTitle}><h1 aria-label={title}><svg className={styles.overviewTitleArt} viewBox={artwork.viewBox} aria-hidden="true"><image href={artwork.source} width={mode==="store"?"2171":"2172"} height="724"/></svg></h1><p>{description}</p></div></header>:null}
    {mode==="overview" ? <SupplyOverview snapshot={snapshot} /> : null}
    {mode==="inventory" ? <SupplyInventory snapshot={snapshot} /> : null}
    {mode==="distribute" ? <SupplyDistribute snapshot={snapshot} requestId={requestId} /> : null}
    {mode==="requests" ? <SupplyRequests key={`${storeId??""}:${requestId??""}`} snapshot={snapshot} initialStoreId={storeId} initialRequestId={requestId} /> : null}
    {mode==="history" ? <SupplyHistory snapshot={snapshot} initialStoreId={storeId} /> : null}
    {mode==="store" ? <SupplyStoreDetail snapshot={snapshot} /> : null}
  </div>;
}
