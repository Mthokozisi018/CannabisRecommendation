import { datePartsInTimeZone, pad } from "@/lib/manager/report-calendar";
import type { SupplySnapshot } from "./data";

export type SupplyPerformanceSale = { date: string; receivedAt: string; productId: string; product: string; category: string; units: number; revenueCents: number };
export type SupplyPerformance = {
  monthReceived: number; yearReceived: number;
  monthRevenueCents: number | null; yearRevenueCents: number | null;
  revenueReliable: boolean; unitsReliable: boolean; reason: string | null;
  sales: SupplyPerformanceSale[];
};

const monthKey = (value: string | Date) => { const p=datePartsInTimeZone(new Date(value)); return `${p.year}-${pad(p.month)}`; };
const yearKey = (value: string | Date) => datePartsInTimeZone(new Date(value)).year;

export function buildSupplyPerformance(snapshot: SupplySnapshot, now = new Date()): SupplyPerformance {
  const storeId=snapshot.storeId;
  const deliveries=new Map<string,{id:string;receivedAt:string;quantity:number}[]>();
  let monthReceived=0, yearReceived=0;
  const currentMonth=monthKey(now), currentYear=yearKey(now);
  for(const distribution of snapshot.distributions) {
    if(distribution.store_id!==storeId || !distribution.received_at || !["delivered","discrepancy"].includes(distribution.status)) continue;
    for(const item of distribution.master_supply_distribution_items) {
      const quantity=item.received_quantity??0;
      if(quantity<=0) continue;
      if(monthKey(distribution.received_at)===currentMonth) monthReceived+=quantity;
      if(yearKey(distribution.received_at)===currentYear) yearReceived+=quantity;
      const rows=deliveries.get(item.product_id)??[];
      rows.push({id:distribution.id,receivedAt:distribution.received_at,quantity});
      deliveries.set(item.product_id,rows);
    }
  }
  const products=new Map(snapshot.products.map(product=>[product.id,product]));
  const sales:SupplyPerformanceSale[]=[];
  let revenueReliable=true, unitsReliable=true;
  const seen=new Set<string>();
  for(const allocation of snapshot.allocations) {
    if(allocation.store_id!==storeId || seen.has(allocation.sale_item_id)) continue;
    seen.add(allocation.sale_item_id);
    const sale=allocation.pos_sales;
    if(!sale || sale.status!=="completed") continue;
    const totalCents=Math.round(Number(sale.total)*100);
    const refundedCents=Math.round(Number(sale.refunded_amount)*100);
    if(totalCents>0 && refundedCents>=totalCents) continue;
    if(refundedCents>0) { revenueReliable=false; unitsReliable=false; continue; }
    const eligible=(deliveries.get(allocation.master_product_id)??[]).filter(row=>row.receivedAt<=allocation.created_at);
    const batch=allocation.distribution_id
      ? eligible.find(row=>row.id===allocation.distribution_id)
      : eligible.length===1 ? eligible[0] : undefined;
    if(!batch) { revenueReliable=false; unitsReliable=false; continue; }
    const item=allocation.pos_sale_items;
    if(!item || item.quantity<allocation.quantity || !Number.isFinite(Number(item.line_total))) {
      revenueReliable=false; unitsReliable=false; continue;
    }
    const product=products.get(allocation.master_product_id);
    sales.push({date:allocation.created_at,receivedAt:batch.receivedAt,productId:allocation.master_product_id,
      product:product?.name??"Unknown product",category:product?.category??"Uncategorised",
      units:allocation.quantity,revenueCents:Math.round(Number(item.line_total)*100*allocation.quantity/item.quantity)});
  }
  const sumRevenue=(period:"month"|"year")=>sales.filter(row=>period==="month"?monthKey(row.receivedAt)===currentMonth:yearKey(row.receivedAt)===currentYear).reduce((sum,row)=>sum+row.revenueCents,0);
  return {monthReceived,yearReceived,monthRevenueCents:revenueReliable?sumRevenue("month"):null,
    yearRevenueCents:revenueReliable?sumRevenue("year"):null,revenueReliable,unitsReliable,
    reason:revenueReliable&&unitsReliable?null:"Some sales cannot be tied reliably to a delivery batch or contain a partial refund. Supply revenue and sold-unit charts are unavailable until batch and item-level refund attribution is recorded.",sales};
}

export type PerformancePeriod = "days"|"weeks"|"months"|"years";
export function performanceBucket(value:string|Date, period:PerformancePeriod) {
  const p=datePartsInTimeZone(new Date(value));
  if(period==="years") return String(p.year);
  if(period==="months") return `${p.year}-${pad(p.month)}`;
  const day=`${p.year}-${pad(p.month)}-${pad(p.day)}`;
  if(period==="days") return day;
  const utc=Date.UTC(p.year,p.month-1,p.day);
  const weekday=new Date(utc).getUTCDay()||7;
  const start=new Date(utc-(weekday-1)*86400000);
  return start.toISOString().slice(0,10);
}
export function performanceBuckets(now:Date, period:PerformancePeriod) {
  const current=datePartsInTimeZone(now);
  const count=period==="days"?14:period==="weeks"?12:period==="months"?12:5;
  return Array.from({length:count},(_,index)=>{
    const delta=index-count+1;
    const date=period==="days"?new Date(Date.UTC(current.year,current.month-1,current.day+delta,12))
      :period==="weeks"?new Date(Date.UTC(current.year,current.month-1,current.day+delta*7,12))
      :period==="months"?new Date(Date.UTC(current.year,current.month-1+delta,1,12))
      :new Date(Date.UTC(current.year+delta,0,1,12));
    return performanceBucket(date.toISOString(),period);
  });
}
