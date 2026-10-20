import type { SupplySnapshot, SupplyStore } from "./data";
import { datePartsInTimeZone } from "@/lib/manager/report-calendar";

export type SupplyPeriod = "day" | "week" | "month" | "year";
export type StoreSupplyRow = { store: SupplyStore; received: number; sold: number; remaining: number; soldPercent: number; pendingReserved: number; pendingTransit: number; requests: number; active: boolean };

const key = (value: Date) => {
  const { year, month, day } = datePartsInTimeZone(value);
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
};
const utcKey = (value: number) => new Date(value).toISOString().slice(0,10);
const within = (value: string | null, start: string, end: string) => {
  if (!value) return false;
  const date = key(new Date(value));
  return date>=start && date<end;
};

export function supplyPeriodBounds(period: SupplyPeriod, now = new Date()) {
  const { year, month, day } = datePartsInTimeZone(now);
  const today = Date.UTC(year,month-1,day);
  const weekday = (new Date(today).getUTCDay()+6)%7;
  const start = period==="day" ? today : period==="week" ? today-weekday*86400000 : period==="month" ? Date.UTC(year,month-1,1) : Date.UTC(year,0,1);
  const end = period==="day" ? today+86400000 : period==="week" ? start+7*86400000 : period==="month" ? Date.UTC(year,month,1) : Date.UTC(year+1,0,1);
  const previous = period==="day" ? start-86400000 : period==="week" ? start-7*86400000 : period==="month" ? Date.UTC(year,month-2,1) : Date.UTC(year-1,0,1);
  return { start:utcKey(start), end:utcKey(end), previous:utcKey(previous) };
}

export function supplyOverviewMetrics(snapshot: SupplySnapshot, period: SupplyPeriod, now = new Date()) {
  const { start, end, previous } = supplyPeriodBounds(period,now);
  const totals = (from: string, to: string) => ({
    received: snapshot.receipts.filter(r=>within(r.created_at,from,to)).reduce((sum,r)=>sum+r.quantity,0),
    distributed: snapshot.distributions.filter(d=>["in_transit","delivered","discrepancy"].includes(d.status)&&within(d.dispatched_at,from,to)).reduce((sum,d)=>sum+d.master_supply_distribution_items.reduce((n,i)=>n+i.quantity,0),0),
    sold: snapshot.allocations.filter(a=>a.pos_sales?.status==="completed"&&Number(a.pos_sales.refunded_amount)===0&&within(a.created_at,from,to)).reduce((sum,a)=>sum+a.quantity,0)
  });
  const current = totals(start,end);
  const prior = totals(previous,start);
  const activeDistributionIds = new Set(snapshot.distributions.filter(d=>d.status!=="cancelled"&&d.request_id).map(d=>d.request_id));
  const outstanding = snapshot.requests.filter(r=>["pending","partially_fulfilled"].includes(r.status)||(["approved","partially_approved"].includes(r.status)&&!activeDistributionIds.has(r.id)));
  const rows: StoreSupplyRow[] = snapshot.stores.map(store=>{
    const received = snapshot.distributions.filter(d=>d.store_id===store.id&&within(d.received_at,start,end)).reduce((sum,d)=>sum+d.master_supply_distribution_items.reduce((n,i)=>n+(i.received_quantity??0),0),0);
    const sold = snapshot.allocations.filter(a=>a.store_id===store.id&&a.pos_sales?.status==="completed"&&Number(a.pos_sales.refunded_amount)===0&&within(a.created_at,start,end)).reduce((sum,a)=>sum+a.quantity,0);
    const distributions = snapshot.distributions.filter(d=>d.store_id===store.id);
    return { store, received, sold, remaining:snapshot.stocks.filter(s=>s.store_id===store.id).reduce((sum,s)=>sum+s.quantity,0), soldPercent:received>0?Math.round(sold/received*100):0,
      pendingReserved:distributions.filter(d=>d.status==="reserved").length, pendingTransit:distributions.filter(d=>d.status==="in_transit").length,
      requests:outstanding.filter(r=>r.store_id===store.id).length, active:store.is_active&&store.store_access_status==="active" };
  });
  return { current, prior, masterInventory:snapshot.products.reduce((sum,p)=>sum+p.on_hand-p.reserved,0), remaining:snapshot.stocks.reduce((sum,s)=>sum+s.quantity,0), outstandingRequests:outstanding.length, rows };
}
