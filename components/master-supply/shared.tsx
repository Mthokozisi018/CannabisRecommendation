"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { masterSupplyAction, type SupplyAction } from "@/app/dashboard/franchise/supply/actions";
import type { MasterProduct, SupplyStore } from "@/lib/master-supply/data";
import styles from "./MasterSupply.module.css";

export const BASE = "/dashboard/franchise/supply";
export const number = (value: number) => new Intl.NumberFormat("en-ZA").format(value);
export const stamp = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en-ZA", { dateStyle:"medium", timeStyle:"short", timeZone:"Africa/Johannesburg" }).format(new Date(value)) : "—";
export const day = (value: string) => new Intl.DateTimeFormat("en-CA", { year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Africa/Johannesburg" }).format(new Date(value));
export const location = (store?: SupplyStore) => [store?.city, store?.province].filter(Boolean).join(", ") || "—";

export function Status({ value }: { value: string }) {
  const label: Record<string,string> = { partially_approved:"Partially approved", partially_fulfilled:"Partially fulfilled", in_transit:"In transit" };
  const tone = value === "rejected" || value === "cancelled" || value === "discrepancy" ? styles.error : value === "pending" || value === "reserved" || value === "partially_fulfilled" ? styles.warn : value === "in_transit" ? styles.info : "";
  return <span className={`${styles.badge} ${tone}`}>{label[value] ?? value.replace(/^./, x => x.toUpperCase())}</span>;
}

export function ProductLabel({ product }: { product?: MasterProduct }) {
  if (!product) return <span className={styles.muted}>Unknown product</span>;
  return <span className={styles.product}>{product.image_url ? <Image src={product.image_url} alt="" width={42} height={42} unoptimized /> : <span className={styles.badge}>◆</span>}<span><strong>{product.name}</strong><small>{product.sku}</small></span></span>;
}

export function StoreLabel({ store }: { store?: SupplyStore }) {
  if (!store) return <span className={styles.muted}>Unknown store</span>;
  return <span className={styles.store}>{store.store_image_url ? <Image src={store.store_image_url} alt="" width={42} height={42} unoptimized /> : null}<span><strong>{store.name}</strong><small>{location(store)}</small></span></span>;
}

export function Pager({ page, setPage, count, size = 10 }: { page: number; setPage: (n:number)=>void; count: number; size?: number }) {
  const pages = Math.max(1,Math.ceil(count/size));
  const current = Math.min(page,pages-1);
  return <div className={styles.pager}><span>Showing {count ? current*size+1 : 0} – {Math.min(count,(current+1)*size)} of {count}</span><nav aria-label="Pagination"><button disabled={current===0} onClick={()=>setPage(current-1)}>‹</button>{Array.from({length:Math.min(pages,5)},(_,i)=>Math.max(0,Math.min(pages-5,current-2))+i).map(n=><button key={n} aria-current={n===current?"page":undefined} onClick={()=>setPage(n)}>{n+1}</button>)}<button disabled={current>=pages-1} onClick={()=>setPage(current+1)}>›</button></nav></div>;
}

export function Notice({ message, error = false }: { message: string; error?: boolean }) {
  return message ? <div role={error ? "alert" : "status"} className={`${styles.notice} ${error ? styles.messageError : ""}`}>{message}</div> : null;
}

export function useSupplyMutation() {
  const router = useRouter();
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState(false);
  async function run(action: SupplyAction, payload: unknown) {
    setBusy(true); setMessage("");
    try {
      const result = await masterSupplyAction(action,payload);
      if (!result.ok) { setError(true); setMessage(result.message); return result; }
      setError(false); setMessage("Saved successfully."); router.refresh(); return result;
    } catch (cause) {
      const result = { ok:false as const, message: cause instanceof Error ? cause.message : "The action failed." };
      setError(true); setMessage(result.message); return result;
    } finally { setBusy(false); }
  }
  return { busy, message, error, run, clear:()=>setMessage("") };
}
