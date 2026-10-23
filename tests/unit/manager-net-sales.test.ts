import { expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import {readStoreNetRevenue} from '@/lib/manager/net-sales';
import {buildManagerSalesReport,parseSalesReportFilters} from '@/lib/manager/sales-overview';
import {summarizeFranchiseSales,reportPeriod} from '@/lib/franchise/reporting';
it('reconciles the R620 example, partial refunds, calendar KPIs and franchise revenue with retained history',()=>{
 const sales=[370,150,250,100,80].map((total,i)=>({id:String(i),store_id:'store',checkout_id:null,customer_id:null,staff_user_id:null,total,refunded_amount:[0,150,0,100,30][i],created_at:'2026-10-17T08:00:00Z',payment_method:'cash'}));
 const build=(rows:typeof sales)=>buildManagerSalesReport({sales:rows,items:[],customers:[],staff:[]},parseSalesReportFilters({month:'2026-10'}),true,{weekSales:rows,monthSales:rows,yearSales:rows,currentYearLabel:'2026',currentWeekLabel:'Week',currentMonthLabel:'Month'});
 expect(build(sales.slice(0,4)).summary.revenue).toBe(620);
 const manager=build(sales);expect(manager.summary.revenue).toBe(670);
 expect(manager.kpis).toMatchObject({revenueThisWeek:670,revenueThisMonth:670,revenueThisYear:670});
 expect(manager.transactions).toHaveLength(5);expect(manager.transactions.find(t=>t.saleId==='1')?.recordedTotal).toBe(150);
 expect(summarizeFranchiseSales(sales,reportPeriod({from:'2026-10-01',to:'2026-10-17'})).revenue).toBe(manager.summary.revenue);
});
it('reads all daily pages with scoped bounds and deducts the cumulative refund once per sale ID',async()=>{
 const calls:unknown[][]=[];
 const query={select:(...args:unknown[])=>{calls.push(args);return query;},eq:(...args:unknown[])=>{calls.push(args);return query;},gte:(...args:unknown[])=>{calls.push(args);return query;},lt:(...args:unknown[])=>{calls.push(args);return query;},order:()=>query,range:vi.fn(async(offset:number)=>({error:null,data:offset===0?Array.from({length:500},(_,i)=>({id:String(i),total:1,refunded_amount:0.25})):[{id:'0',total:1,refunded_amount:0.25},{id:'last',total:100,refunded_amount:100}]}))};
 const client={from:vi.fn(()=>query)};
 expect(await readStoreNetRevenue(client as never,'store-a',new Date('2026-10-16T22:00Z'),new Date('2026-10-17T22:00Z'))).toBe(375);
 expect(calls).toContainEqual(['store_id','store-a']);expect(calls).toContainEqual(['status','completed']);expect(calls).toContainEqual(['created_at','2026-10-16T22:00:00.000Z']);
 query.range.mockResolvedValueOnce({data:[],error:{message:'denied'} as never});
 await expect(readStoreNetRevenue(client as never,'store-a',new Date(),new Date())).rejects.toThrow('Net sales could not be loaded');
});
