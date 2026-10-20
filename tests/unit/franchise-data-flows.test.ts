import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {store,staff,now} from '../fixtures/franchise-ui';
const m=vi.hoisted(()=>({auth:vi.fn(),own:vi.fn(),rpc:vi.fn(),from:vi.fn(),history:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/franchise/auth',()=>({requireFranchiseAdmin:m.auth,requireFranchiseStore:m.own}));
vi.mock('@/lib/franchise/manager-login-history',()=>({getManagerLoginHistory:m.history}));
vi.mock('@/lib/franchise/totals-cache',()=>({cachedFranchiseTotals:(_scope:unknown,load:()=>unknown)=>load()}));
import {getFranchiseDirectory,getStoreManagement,getStoreReportDetails,getFranchiseReport,getFranchiseHome,getStoreLowStock,getStoreDetailPeriod,getStoreRevenuePeriod} from '@/lib/franchise/data';
import {reportPeriod} from '@/lib/franchise/reporting';
type Result={data:unknown,error:null|{code:string}};
const calls:{table:string,method:string,args:unknown[]}[]=[];
let failures:Record<string,boolean>={};
const sale={id:'sale-A',store_id:store.id,customer_id:null,staff_user_id:staff.auth_user_id,checkout_id:'receipt',total:12,refunded_amount:2.01,payment_method:'split',created_at:now};
const item={sale_id:sale.id,product_name_snapshot:'Fixture product',category_snapshot:'Flower',subcategory_snapshot:'Indoor',quantity:2,unit_price:6,line_total:12};
beforeEach(()=>{
 vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date(now));failures={};calls.length=0;
 m.from.mockImplementation((table:string)=>{
   let selection='';const query:Record<string,unknown>={};
   const result=():Result=>{
     const rows=table==='franchises'?{id:'tenant-A',name:'Franchise A'}:table==='stores'?[store]:table==='staff_profiles'?[staff]:table==='pos_sales'?selection.startsWith('created_at')?[{created_at:'2024-02-01T10:00:00Z'}]:[sale]:table==='pos_sale_items'?[item]:table==='audit_logs'?[{user_id:staff.auth_user_id,store_id:store.id,details:{role:'manager'},created_at:now}]:table==='products'?[{id:'low',product_name:'Low product',inventory_stock:[{current_quantity:1,low_stock_threshold:5}]}]:[];
     return {data:rows,error:failures[table]?{code:'unavailable'}:null};
   };
   for(const method of ['select','eq','filter','in','neq','is','order','gt','gte','lt','lte','contains'])query[method]=(...args:unknown[])=>{calls.push({table,method,args});if(method==='select')selection=String(args[0]);return query;};
   query.single=async()=>result();query.range=async()=>result();query.limit=async()=>result();
   query.then=(resolve:(value:Result)=>unknown,reject:(error:unknown)=>unknown)=>Promise.resolve(result()).then(resolve,reject);
   return query;
 });
 const context={supabase:{from:m.from,rpc:m.rpc},franchiseId:'tenant-A',session:{authUserId:'verified',displayName:'FA'}};
 m.auth.mockResolvedValue(context);m.own.mockResolvedValue({...context,store});m.history.mockResolvedValue({rows:[],hasNext:false});
 m.rpc.mockImplementation(async(name:string)=>({data:name==='franchise_store_item_totals'?{categories:[{label:'Flower',value:9.99}],products:[{key:'flower',name:'Fixture product',quantity:2,revenue:9.99}]}:{daily:[{store_id:store.id,day:'2026-10-16',revenue:9.99,transactions:1}],customers:[{store_id:store.id,count:2}]},error:null}));
});
afterEach(()=>vi.useRealTimers());
it('directory scopes both store and joined staff queries to the current franchise',async()=>{
 const d=await getFranchiseDirectory(store.id);expect(d.stores).toEqual([store]);expect(d.staff).toEqual([staff]);expect(calls).toContainEqual({table:'stores',method:'eq',args:['franchise_id','tenant-A']});expect(calls).toContainEqual({table:'staff_profiles',method:'eq',args:['stores.franchise_id','tenant-A']});expect(calls).toContainEqual({table:'staff_profiles',method:'filter',args:['store_id','eq',store.id]});
});
it('home deduplicates manager identities and uses net SQL revenue for today',async()=>{
 const home=await getFranchiseHome();expect(home.salesToday).toBe(9.99);expect(home.loggedIn.map(s=>s.auth_user_id)).toEqual([staff.auth_user_id]);expect(home.activeManagers).toBe(1);expect(calls).toContainEqual({table:'audit_logs',method:'contains',args:['details',{role:'manager'}]});
});
it('management returns only guarded store staff, history and recent successful logins',async()=>{
 const d=await getStoreManagement(store.id);expect(m.own).toHaveBeenCalledWith(store.id);expect(d.store).toEqual(store);expect(d.staff).toEqual([staff]);expect(m.history).toHaveBeenCalledWith(store.id);expect(calls).toContainEqual({table:'audit_logs',method:'eq',args:['store_id',store.id]});
});
it('store details aggregate in SQL and fetch line data only for the recent authorized sale IDs',async()=>{
 const period=reportPeriod({from:'2026-10-01',to:'2026-10-16'});const d=await getStoreReportDetails(store.id,period);
 expect(d.categories).toEqual([{label:'Flower',value:9.99}]);expect(d.transactions[0]).toMatchObject({recordedTotal:12,refundedAmount:2.01,itemCount:2,paymentMethod:'split'});
 expect(m.rpc).toHaveBeenCalledWith('franchise_store_item_totals',{p_store_id:store.id,p_start:period.start.toISOString(),p_end:period.end.toISOString()});expect(calls).toContainEqual({table:'pos_sale_items',method:'in',args:['sale_id',['sale-A']]});
});
it('franchise and store reports reconcile net SQL totals and customer/transaction definitions',async()=>{
 const whole=await getFranchiseReport({from:'2026-10-01',to:'2026-10-16'});const own=await getFranchiseReport({from:'2026-10-01',to:'2026-10-16'},store.id);
 expect(whole.summary.revenue).toBe(9.99);expect(own.summary.revenue).toBe(whole.summary.revenue);expect(own.performance[0]).toMatchObject({revenue:9.99,transactions:1,customers:2});expect(own.customers).toBe(2);expect(own.products[0].revenue).toBe(9.99);expect(own.transactions).toHaveLength(1);
});
it('independent detail filters preserve guarded store/range and completed transaction counts',async()=>{
 const d=await getStoreDetailPeriod(store.id,{from:'2026-10-01',to:'2026-10-16'});expect(d.transactionCount).toBe(1);expect(d.from).toBe('2026-10-01');expect(d.transactions[0].refundedAmount).toBe(2.01);
});
it('low-stock calculation uses current product/stock rows only after store authorization',async()=>{
 expect(await getStoreLowStock(store.id)).toEqual([{id:'low',name:'Low product',quantity:1,threshold:5}]);expect(calls).toContainEqual({table:'products',method:'eq',args:['product_status','active']});expect(calls).toContainEqual({table:'products',method:'is',args:['deleted_at',null]});
});
it.each(['franchises','stores','staff_profiles'])('fails closed when directory %s cannot be read',async(table)=>{failures[table]=true;await expect(getFranchiseDirectory()).rejects.toThrow();});
it('never renders synthetic zero data for failed report, transaction or login reads',async()=>{
 m.rpc.mockResolvedValueOnce({data:null,error:{code:'timeout'}});await expect(getStoreReportDetails(store.id,reportPeriod({}))).rejects.toThrow('Product totals could not be loaded');failures.pos_sales=true;await expect(getStoreReportDetails(store.id,reportPeriod({}))).rejects.toThrow('Transactions could not be loaded');failures.audit_logs=true;await expect(getStoreManagement(store.id)).rejects.toThrow('Login history could not be loaded');
});
it('foreign stores are rejected before summary or item queries',async()=>{m.own.mockRejectedValueOnce(Error('Foreign store'));await expect(getStoreReportDetails('foreign',reportPeriod({}))).rejects.toThrow('Foreign store');expect(m.rpc).not.toHaveBeenCalled();expect(m.from).not.toHaveBeenCalled();});
it('loads home with row fallback when every aggregate RPC is absent',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}});
 const home=await getFranchiseHome();expect(home.salesToday).toBe(9.99);
 expect(m.rpc.mock.calls.map(([name])=>name)).toEqual(['franchise_dashboard_totals_v3','franchise_dashboard_totals_v2','franchise_dashboard_totals']);
 expect(calls).toContainEqual({table:'pos_sales',method:'eq',args:['stores.franchise_id','tenant-A']});
 expect(calls).toContainEqual({table:'pos_sales',method:'eq',args:['status','completed']});
 expect(calls).toContainEqual({table:'pos_sales',method:'gte',args:['created_at','2026-10-15T22:00:00.000Z']});
 expect(calls).toContainEqual({table:'pos_sales',method:'lt',args:['created_at','2026-10-16T22:00:00.000Z']});
 expect(m.from).not.toHaveBeenCalledWith('pos_customers');
});
it('uses the deployed gross aggregate with only refunded sales adjusted',async()=>{
 m.rpc.mockImplementation(async(name:string)=> name==='franchise_dashboard_totals'
   ? {data:{daily:[{store_id:store.id,day:'2026-10-16',revenue:12,transactions:1}],customers:[]},error:null}
   : {data:null,error:{code:'PGRST202'}});
 const home=await getFranchiseHome();expect(home.salesToday).toBe(9.99);
 expect(calls).toContainEqual({table:'pos_sales',method:'gt',args:['refunded_amount',0]});
 expect(calls).toContainEqual({table:'pos_sales',method:'eq',args:['stores.franchise_id','tenant-A']});
 expect(m.from).not.toHaveBeenCalledWith('pos_customers');
});
it('keeps fallback store filters and current authorization',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}});
 const result=await getStoreRevenuePeriod(store.id,{from:'2026-10-01',to:'2026-10-16'});
 expect(result.daily).toEqual([{store_id:store.id,day:'2026-10-16',revenue:9.99,transactions:1}]);
 expect(m.own).toHaveBeenCalledWith(store.id);
 expect(calls).toContainEqual({table:'pos_sales',method:'eq',args:['store_id',store.id]});
});
it.each(['42501','timeout'])('does not mask RPC %s errors with compatibility reads',async(code)=>{
 m.rpc.mockResolvedValue({data:null,error:{code}});
 await expect(getFranchiseHome()).rejects.toThrow('Dashboard totals could not be loaded');
 expect(m.from).not.toHaveBeenCalledWith('pos_sales');
});
it('fails rather than showing zero revenue when the compatibility sales read fails',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}});failures.pos_sales=true;
 await expect(getFranchiseHome()).rejects.toThrow('Dashboard totals could not be loaded');
});
it('accumulates all fallback pages and groups net cents by local day and store',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}});
 const original=m.from.getMockImplementation()!;
 m.from.mockImplementation((table:string)=>{
   const query=original(table);
   if(table==='pos_sales')query.range=vi.fn(async(offset:number)=>({error:null,data:offset===0?Array.from({length:500},()=>({...sale,total:'0.03',refunded_amount:'0.01'})):[{...sale,total:10,refunded_amount:10,created_at:'2026-10-15T22:00:00Z'}]}));
   return query;
 });
 const home=await getFranchiseHome();expect(home.salesToday).toBe(10);
});
it('loads the complete store report with both aggregate functions missing',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}});
 const report=await getFranchiseReport({from:'2026-10-01',to:'2026-10-16'},store.id);
 expect(report.summary.revenue).toBe(9.99);
 expect(report.categories).toEqual([{label:'Flower',value:9.99}]);
 expect(report.products).toMatchObject([{name:'Fixture product',quantity:2,revenue:9.99}]);
 expect(report.transactions).toHaveLength(1);
 expect(calls).toContainEqual({table:'pos_sales',method:'eq',args:['stores.franchise_id','tenant-A']});
 expect(calls).toContainEqual({table:'pos_sale_items',method:'in',args:['sale_id',['sale-A']]});
});
it('preserves product-total permission failures instead of falling back',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{code:'42501'}});
 await expect(getStoreReportDetails(store.id,reportPeriod({}))).rejects.toThrow('Product totals could not be loaded');
 expect(m.from).not.toHaveBeenCalledWith('pos_sale_items');
});
it('does not show empty product totals when a fallback item read fails',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}});failures.pos_sale_items=true;
 await expect(getStoreReportDetails(store.id,reportPeriod({}))).rejects.toThrow('Franchise data could not be loaded');
});
