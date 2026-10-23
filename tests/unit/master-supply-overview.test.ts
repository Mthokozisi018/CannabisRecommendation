import { expect, it } from "vitest";
import { supplyOverviewMetrics, supplyPeriodBounds } from "@/lib/master-supply/overview-metrics";
import type { SupplySnapshot } from "@/lib/master-supply/data";

it("uses Johannesburg calendar boundaries for every dashboard period",()=>{
  const now=new Date("2026-10-18T22:30:00Z");
  expect(supplyPeriodBounds("day",now)).toEqual({start:"2026-10-19",end:"2026-10-20",previous:"2026-10-18"});
  expect(supplyPeriodBounds("week",now)).toEqual({start:"2026-10-19",end:"2026-10-26",previous:"2026-10-12"});
  expect(supplyPeriodBounds("month",now)).toEqual({start:"2026-10-01",end:"2026-11-01",previous:"2026-09-01"});
  expect(supplyPeriodBounds("year",now)).toEqual({start:"2026-01-01",end:"2027-01-01",previous:"2025-01-01"});
});

it("keeps stock balances current while filtering activity, refunds, requests and store status",()=>{
  const snapshot={
    franchiseId:"f", products:[{on_hand:70,reserved:10}], stores:[{id:"a",name:"Store A",city:"Pretoria",province:"Gauteng",store_image_url:null,is_active:true,store_access_status:"active"},{id:"b",name:"Store B",city:"Johannesburg",province:"Gauteng",store_image_url:null,is_active:true,store_access_status:"suspended"}],
    receipts:[{quantity:20,created_at:"2026-10-05T08:00:00Z"},{quantity:10,created_at:"2026-09-05T08:00:00Z"}],
    distributions:[{id:"d1",store_id:"a",request_id:"linked",status:"delivered",dispatched_at:"2026-10-06T08:00:00Z",received_at:"2026-10-07T08:00:00Z",master_supply_distribution_items:[{quantity:15,received_quantity:14}]},{id:"d2",store_id:"b",request_id:null,status:"reserved",dispatched_at:null,received_at:null,master_supply_distribution_items:[{quantity:5,received_quantity:null}]}],
    allocations:[{store_id:"a",quantity:8,created_at:"2026-10-08T08:00:00Z",pos_sales:{status:"completed",refunded_amount:0}},{store_id:"a",quantity:3,created_at:"2026-10-08T08:00:00Z",pos_sales:{status:"completed",refunded_amount:50}},{store_id:"b",quantity:2,created_at:"2026-09-08T08:00:00Z",pos_sales:{status:"completed",refunded_amount:0}}],
    stocks:[{store_id:"a",quantity:6},{store_id:"b",quantity:9}],
    requests:[{id:"pending",store_id:"a",status:"pending"},{id:"approved",store_id:"b",status:"approved"},{id:"partial",store_id:"b",status:"partially_fulfilled"},{id:"linked",store_id:"a",status:"approved"}],
    restocks:[],adjustments:[],names:{}
  } as unknown as SupplySnapshot;
  const result=supplyOverviewMetrics(snapshot,"month",new Date("2026-10-19T12:00:00Z"));
  expect(result.current).toEqual({received:20,distributed:15,sold:8});
  expect(result.prior).toEqual({received:10,distributed:0,sold:2});
  expect(result.masterInventory).toBe(60);
  expect(result.remaining).toBe(15);
  expect(result.outstandingRequests).toBe(3);
  expect(result.rows[0]).toMatchObject({received:14,sold:8,remaining:6,soldPercent:57,requests:1,active:true});
  expect(result.rows[1]).toMatchObject({received:0,sold:0,remaining:9,pendingReserved:1,requests:2,active:false});
});
