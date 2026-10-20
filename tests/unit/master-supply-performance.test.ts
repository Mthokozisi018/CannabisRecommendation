import { expect, it } from "vitest";
import { buildSupplyPerformance, performanceBucket, performanceBuckets } from "@/lib/master-supply/performance";
import type { SupplySnapshot } from "@/lib/master-supply/data";

const now=new Date("2026-10-20T12:00:00Z");
function fixture() {
 return {
  franchiseId:"f",storeId:"store-a",demo:true,
  products:[{id:"product",name:"Flower A",category:"Flower"}],
  stores:[{id:"store-a",name:"A"}],
  distributions:[
   {id:"sept",store_id:"store-a",status:"delivered",received_at:"2026-09-30T20:30:00Z",master_supply_distribution_items:[{product_id:"product",quantity:10,received_quantity:8}]},
   {id:"oct",store_id:"store-a",status:"discrepancy",received_at:"2026-09-30T22:30:00Z",master_supply_distribution_items:[{product_id:"product",quantity:10,received_quantity:7}]},
   {id:"pending",store_id:"store-a",status:"in_transit",received_at:null,master_supply_distribution_items:[{product_id:"product",quantity:50,received_quantity:null}]},
   {id:"other",store_id:"store-b",status:"delivered",received_at:"2026-10-02T10:00:00Z",master_supply_distribution_items:[{product_id:"product",quantity:100,received_quantity:100}]}
  ],
  allocations:[
   {sale_item_id:"sale-1",sale_id:"s1",store_id:"store-a",master_product_id:"product",distribution_id:"sept",quantity:2,created_at:"2026-10-03T10:00:00Z",pos_sale_items:{quantity:2,line_total:40},pos_sales:{status:"completed",total:40,refunded_amount:0}},
   {sale_item_id:"sale-2",sale_id:"s2",store_id:"store-a",master_product_id:"product",distribution_id:"oct",quantity:3,created_at:"2026-10-04T10:00:00Z",pos_sale_items:{quantity:3,line_total:60},pos_sales:{status:"completed",total:60,refunded_amount:0}},
   {sale_item_id:"refund",sale_id:"s3",store_id:"store-a",master_product_id:"product",distribution_id:"oct",quantity:1,created_at:"2026-10-04T10:00:00Z",pos_sale_items:{quantity:1,line_total:20},pos_sales:{status:"completed",total:20,refunded_amount:20}},
   {sale_item_id:"other-sale",sale_id:"s4",store_id:"store-b",master_product_id:"product",quantity:10,created_at:"2026-10-04T10:00:00Z",pos_sale_items:{quantity:10,line_total:200},pos_sales:{status:"completed",total:200,refunded_amount:0}}
  ],requests:[],stocks:[],receipts:[],restocks:[],adjustments:[],names:{}
 } as unknown as SupplySnapshot;
}
it("uses confirmed receipt dates in Johannesburg and attributes October sales to their receipt batch",()=>{
 const report=buildSupplyPerformance(fixture(),now);
 expect(report.monthReceived).toBe(7);
 expect(report.yearReceived).toBe(15);
 expect(report.monthRevenueCents).toBe(6000);
 expect(report.yearRevenueCents).toBe(10000);
 expect(report.sales.map(s=>s.units)).toEqual([2,3]);
 expect(performanceBucket("2026-09-30T22:30:00Z","months")).toBe("2026-10");
 expect(performanceBuckets(now,"weeks")).toHaveLength(12);
});
it("reports an attribution limitation for ambiguous batches and partial refunds",()=>{
 const snapshot=fixture();
 delete snapshot.allocations[0].distribution_id;
 expect(buildSupplyPerformance(snapshot,now).monthRevenueCents).toBeNull();
 snapshot.allocations[0].distribution_id="sept";
 snapshot.allocations[1].pos_sales!.refunded_amount=10;
 const report=buildSupplyPerformance(snapshot,now);
 expect(report.revenueReliable).toBe(false);
 expect(report.unitsReliable).toBe(false);
 expect(report.reason).toContain("partial refund");
});
