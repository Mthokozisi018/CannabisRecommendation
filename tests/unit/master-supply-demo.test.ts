import { afterEach, expect, it, vi } from "vitest";
import { unlink } from "node:fs/promises";
vi.mock("server-only",()=>({}));
import { createSupplyDemoSnapshot, isSupplyDemoAccount, readSupplyDemoSnapshot, supplyDemoFilePath, updateSupplyDemoSnapshot } from "@/lib/master-supply/demo-data";
import { applySupplyDemoAction } from "@/lib/master-supply/demo-action";
import { supplyOverviewMetrics } from "@/lib/master-supply/overview-metrics";
import { buildSupplyPerformance } from "@/lib/master-supply/performance";
import type { SupplyStore } from "@/lib/master-supply/data";

const stores:SupplyStore[]=Array.from({length:5},(_,index)=>({id:`00000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`,name:`GreenChoice Store ${index+1}`,city:"Pretoria",province:"Gauteng",store_image_url:null,is_active:true,store_access_status:"active"}));
const now=new Date("2026-10-19T12:00:00Z");
afterEach(()=>vi.unstubAllEnvs());

it("receives central supply atomically without changing store stock and rejects duplicate products",()=>{
  const snapshot=createSupplyDemoSnapshot("franchise","actor",stores,now);
  const storeStock=snapshot.stocks.map(row=>row.quantity);
  const existing=snapshot.products[0];
  const before=existing.on_hand;
  applySupplyDemoAction(snapshot,"add_stock",{id:crypto.randomUUID(),productId:existing.id,quantity:50,reason:"Central stock received"},"actor",now);
  expect(existing.on_hand).toBe(before+50);
  expect(snapshot.receipts[0]).toMatchObject({product_id:existing.id,quantity:50});
  const input={id:crypto.randomUUID(),sku:"GC-NEW",name:"New Hybrid Flower",category:"Flower",subcategory:"Hybrid",strainType:"Hybrid",cultivationType:"Indoor",price:120,supplierCostPrice:75,imageUrl:"https://example.com/new.webp",description:"",quantity:80};
  applySupplyDemoAction(snapshot,"create_product",input,"actor",now);
  expect(snapshot.products.find(row=>row.id===input.id)).toMatchObject({on_hand:80,total_received:80,supplier_cost_price:75,price:120,image_url:input.imageUrl});
  expect(snapshot.receipts[0]).toMatchObject({product_id:input.id,quantity:80});
  expect(()=>applySupplyDemoAction(snapshot,"create_product",{...input,id:crypto.randomUUID(),sku:"GC-OTHER",name:"new hybrid flower"},"actor",now)).toThrow("already exists");
  expect(snapshot.stocks.map(row=>row.quantity)).toEqual(storeStock);
});

it("seeds mathematically consistent products, store stock, sales, requests and history",()=>{
  const snapshot=createSupplyDemoSnapshot("franchise","actor",stores,now);
  const metrics=supplyOverviewMetrics(snapshot,"month",now);
  expect(metrics.current).toEqual({received:1250,distributed:830,sold:410});
  expect(metrics.masterInventory).toBe(420);
  expect(metrics.remaining).toBe(320);
  expect(metrics.rows.reduce((sum,row)=>sum+row.received,0)).toBe(730);
  expect(metrics.rows.reduce((sum,row)=>sum+row.sold,0)).toBe(410);
  expect(metrics.rows.reduce((sum,row)=>sum+row.remaining,0)).toBe(320);
  expect(new Set(snapshot.requests.map(request=>request.status))).toEqual(new Set(["pending","approved","rejected","fulfilled"]));
  expect(new Set(snapshot.distributions.map(distribution=>distribution.status))).toEqual(new Set(["delivered","in_transit"]));
  expect(snapshot.products).toHaveLength(6);
  const performance=buildSupplyPerformance({...snapshot,storeId:stores[0].id},now);
  expect(performance.revenueReliable).toBe(true);
  expect(performance.monthReceived).toBeGreaterThan(0);
  expect(performance.monthRevenueCents).toBeGreaterThan(0);
  expect(performance.sales.reduce((sum,sale)=>sum+sale.units,0)).toBe(snapshot.allocations.filter(allocation=>allocation.store_id===stores[0].id).reduce((sum,allocation)=>sum+allocation.quantity,0));
});

it("keeps approval, conversion, dispatch and cancellation in the demo snapshot",()=>{
  const snapshot=createSupplyDemoSnapshot("franchise","actor",stores,now);
  const request=snapshot.requests.find(row=>row.status==="pending")!;
  applySupplyDemoAction(snapshot,"review_request",{requestId:request.id,decision:"approve",items:[]},"actor",now);
  expect(request.status).toBe("approved");
  const product=snapshot.products.find(row=>row.id===request.master_supply_request_items[0].product_id)!;
  const original=product.on_hand;
  const distributionId="00000000-0000-4000-8000-000000000099";
  applySupplyDemoAction(snapshot,"distribute",{id:distributionId,storeId:request.store_id,requestId:request.id,deliveryMethod:"standard",notes:"Demo",items:[{productId:product.id,quantity:5}]},"actor",now);
  expect(product.reserved).toBe(5);
  expect(product.on_hand).toBe(original);
  expect(snapshot.distributions[0].status).toBe("reserved");
  applySupplyDemoAction(snapshot,"dispatch",{distributionId},"actor",now);
  expect(product.reserved).toBe(0);
  expect(product.on_hand).toBe(original-5);
  expect(snapshot.distributions[0].status).toBe("in_transit");
  expect(supplyOverviewMetrics(snapshot,"month",now).current.distributed).toBe(835);
  const storeBefore=snapshot.stocks.filter(stock=>stock.store_id===request.store_id).reduce((sum,stock)=>sum+stock.quantity,0);
  applySupplyDemoAction(snapshot,"demo_receive",{distributionId},"actor",now);
  expect(snapshot.distributions[0].status).toBe("delivered");
  expect(request.status).toBe("fulfilled");
  expect(snapshot.stocks.filter(stock=>stock.store_id===request.store_id).reduce((sum,stock)=>sum+stock.quantity,0)).toBe(storeBefore+5);
  expect(supplyOverviewMetrics(snapshot,"month",now).remaining).toBe(325);
  const secondId="00000000-0000-4000-8000-000000000098";
  applySupplyDemoAction(snapshot,"distribute",{id:secondId,storeId:request.store_id,requestId:null,deliveryMethod:"standard",notes:"Demo",items:[{productId:product.id,quantity:3}]},"actor",now);
  applySupplyDemoAction(snapshot,"cancel",{distributionId:secondId},"actor",now);
  expect(product.reserved).toBe(0);
  expect(product.on_hand).toBe(original-5);
  expect(()=>applySupplyDemoAction(snapshot,"distribute",{id:crypto.randomUUID(),storeId:stores[1].id,requestId:request.id,items:[{productId:product.id,quantity:1}]},"actor",now)).toThrow("not eligible");
});

it("does not convert or review a request again after its distribution is cancelled",()=>{
  const snapshot=createSupplyDemoSnapshot("franchise","actor",stores,now);
  const request=snapshot.requests.find(row=>row.status==="pending")!;
  applySupplyDemoAction(snapshot,"review_request",{requestId:request.id,decision:"approve",items:[]},"actor",now);
  const productId=request.master_supply_request_items[0].product_id;
  const id=crypto.randomUUID();
  applySupplyDemoAction(snapshot,"distribute",{id,storeId:request.store_id,requestId:request.id,items:[{productId,quantity:5}]},"actor",now);
  applySupplyDemoAction(snapshot,"cancel",{distributionId:id},"actor",now);
  expect(()=>applySupplyDemoAction(snapshot,"distribute",{id:crypto.randomUUID(),storeId:request.store_id,requestId:request.id,items:[{productId,quantity:5}]},"actor",now)).toThrow("already converted");
  expect(()=>applySupplyDemoAction(snapshot,"review_request",{requestId:request.id,decision:"reject",items:[]},"actor",now)).toThrow("already converted");
});

  it("requires explicit opt-in for the exact signed-in test account's local demo",()=>{
  vi.stubEnv("NODE_ENV","development");
  const session={email:"franchise.admin@example.com",user:{email:"franchise.admin@example.com"},profile:{role:"franchise_admin"}} as unknown as Parameters<typeof isSupplyDemoAccount>[0];
    vi.stubEnv("GREENCHOICE_MASTER_SUPPLY_DEMO","false");
    expect(isSupplyDemoAccount(session)).toBe(false);
    vi.stubEnv("GREENCHOICE_MASTER_SUPPLY_DEMO","true");
  expect(isSupplyDemoAccount(session)).toBe(true);
  expect(isSupplyDemoAccount({...session,email:"other@example.com"})).toBe(false);
  expect(isSupplyDemoAccount({...session,user:{...session.user,email:"other@example.com"}})).toBe(false);
  vi.stubEnv("NODE_ENV","production");
  expect(isSupplyDemoAccount(session)).toBe(false);
  expect(supplyDemoFilePath("actor-a","franchise")).not.toBe(supplyDemoFilePath("actor-b","franchise"));
});

it("persists demo changes only under the account and franchise key",async()=>{
  const actor=crypto.randomUUID(), franchise=crypto.randomUUID(), other=crypto.randomUUID();
  const file=supplyDemoFilePath(actor,franchise);
  try {
    await updateSupplyDemoSnapshot(actor,franchise,stores,snapshot=>{
      applySupplyDemoAction(snapshot,"add_stock",{id:crypto.randomUUID(),productId:snapshot.products[0].id,quantity:7,reason:"Test receipt"},actor,now);
    });
    const saved=await readSupplyDemoSnapshot(actor,franchise,stores);
    const isolated=await readSupplyDemoSnapshot(other,franchise,stores);
    expect(saved.products[0].total_received).toBe(307);
    expect(isolated.products[0].total_received).toBe(300);
    expect(saved.receipts[0].quantity).toBe(7);
  } finally { await unlink(file).catch(()=>undefined); }
});
