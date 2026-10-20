import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DashboardSession } from "@/lib/dashboard-session";
import { datePartsInTimeZone } from "@/lib/manager/report-calendar";
import type { MasterProduct, SupplySnapshot, SupplyStore } from "./data";

export const SUPPLY_DEMO_EMAIL = "franchise.admin@example.com";
export function isSupplyDemoAccount(session: Pick<DashboardSession,"email"|"user"|"profile">) {
  return process.env.NODE_ENV==="development"
    && session.profile.role==="franchise_admin"
    && session.email.toLowerCase()===SUPPLY_DEMO_EMAIL
    && session.user.email?.toLowerCase()===SUPPLY_DEMO_EMAIL;
}

const specs = [
  {sku:"GC-MS-FLW-001",name:"GreenChoice Sunrise Flower",category:"Flower",subcategory:"Hybrid",strain_type:"Hybrid",cultivation_type:"Indoor",price:145,received:300},
  {sku:"GC-MS-FLW-002",name:"GreenChoice Coastal Flower",category:"Flower",subcategory:"Sativa",strain_type:"Sativa",cultivation_type:"Greenhouse",price:135,received:260},
  {sku:"GC-MS-EDB-003",name:"GreenChoice Citrus Gummies",category:"Edibles",subcategory:"Gummies",strain_type:null,cultivation_type:null,price:95,received:220},
  {sku:"GC-MS-VAP-004",name:"GreenChoice Botanical Vape",category:"Vape Cartridges",subcategory:"Vape Cartridge",strain_type:"Hybrid",cultivation_type:null,price:220,received:190},
  {sku:"GC-MS-CON-005",name:"GreenChoice Balance Concentrate",category:"Concentrates",subcategory:"Dab",strain_type:"Hybrid",cultivation_type:null,price:180,received:160},
  {sku:"GC-MS-ACC-006",name:"GreenChoice Storage Jar",category:"Accessories",subcategory:"Storage Containers",strain_type:null,cultivation_type:null,price:110,received:120}
] as const;
const id = (value:string) => {
  const hex=createHash("sha256").update(`greenchoice-master-supply-demo:${value}`).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
};
const daysAgo = (days:number, now:Date) => new Date(now.getTime()-days*86400000).toISOString();
function split(total:number, weights:number[]) {
  if (!weights.length) return [];
  const weight=weights.reduce((sum,n)=>sum+n,0);
  const raw=weights.map(value=>total*value/weight);
  const result=raw.map(Math.floor);
  for(let remaining=total-result.reduce((sum,n)=>sum+n,0);remaining>0;remaining--) {
    const index=raw.map((value,i)=>({i,fraction:value-result[i]})).sort((a,b)=>b.fraction-a.fraction)[0].i;
    result[index]++;
  }
  return result;
}

export function createSupplyDemoSnapshot(franchiseId:string, actorId:string, stores:SupplyStore[], now=new Date()):SupplySnapshot {
  const currentDay=datePartsInTimeZone(now).day;
  const receivedAt=daysAgo(Math.min(1,currentDay-1),now), deliveredAt=daysAgo(Math.min(2,currentDay-1),now), dispatchedAt=daysAgo(Math.min(3,currentDay-1),now), saleAt=daysAgo(Math.min(1,currentDay-1),now);
  const products:MasterProduct[]=specs.map((spec,index)=>({
    id:id(`${franchiseId}:product:${index}`), franchise_id:franchiseId, sku:spec.sku, name:spec.name, category:spec.category,
    subcategory:spec.subcategory, strain_type:spec.strain_type, cultivation_type:spec.cultivation_type, price:spec.price,
    image_url:null, description:`Demo Master Supply product: ${spec.name}.`, on_hand:spec.received, reserved:0,
    total_received:spec.received, last_received_at:receivedAt, created_at:daysAgo(28,now)
  }));
  const receipts=products.map((product,index)=>({id:id(`${franchiseId}:receipt:${index}`),product_id:product.id,quantity:product.total_received,reason:"Demo central stock received",created_at:receivedAt,actor_id:actorId}));
  const distributions:SupplySnapshot["distributions"]=[], stocks:SupplySnapshot["stocks"]=[], allocations:SupplySnapshot["allocations"]=[];
  const requests:SupplySnapshot["requests"]=[];
  const names:Record<string,string>={[actorId]:"Franchise Admin Demo"};
  if(stores.length) {
    const weights=stores.map((_,index)=>Math.max(1,stores.length-index));
    const deliveredByStore=split(730,weights), soldByStore=split(410,weights);
    const transitStores=[stores[0],stores.at(-1)].filter((store,index,list)=>store && list.findIndex(s=>s?.id===store.id)===index) as SupplyStore[];
    const transitByStore=split(100,transitStores.map((_,index)=>index===0?3:2));
    stores.forEach((store,index)=>{
      const managerId=id(`${franchiseId}:manager:${store.id}`); names[managerId]=`${store.name} Manager`;
      const deliveredItems=split(deliveredByStore[index],specs.map(spec=>spec.received)).map((quantity,productIndex)=>({product_id:products[productIndex].id,quantity,received_quantity:quantity}));
      distributions.push({id:id(`${franchiseId}:delivered:${store.id}`),franchise_id:franchiseId,store_id:store.id,request_id:null,status:"delivered",delivery_method:"standard",notes:"Scheduled demo delivery",distributed_by:actorId,received_by:managerId,dispatched_at:dispatchedAt,received_at:deliveredAt,created_at:dispatchedAt,master_supply_distribution_items:deliveredItems});
      const soldItems=split(soldByStore[index],deliveredItems.map(item=>item.quantity));
      deliveredItems.forEach((item,productIndex)=>{
        const sold=soldItems[productIndex], product=products[productIndex];
        stocks.push({store_id:store.id,franchise_id:franchiseId,master_product_id:product.id,product_id:id(`${franchiseId}:store-product:${store.id}:${product.id}`),quantity:item.quantity-sold,received_total:item.quantity,sold_total:sold});
        if(sold>0) allocations.push({sale_item_id:id(`${franchiseId}:sale-item:${store.id}:${product.id}`),sale_id:id(`${franchiseId}:sale:${store.id}:${product.id}`),store_id:store.id,master_product_id:product.id,distribution_id:distributions[distributions.length-1].id,quantity:sold,created_at:saleAt,pos_sale_items:{quantity:sold,line_total:sold*product.price},pos_sales:{status:"completed",refunded_amount:0,total:sold*product.price}});
      });
    });
    transitStores.forEach((store,index)=>{
      const items=split(transitByStore[index],specs.map(spec=>spec.received)).map((quantity,productIndex)=>({product_id:products[productIndex].id,quantity,received_quantity:null}));
      distributions.push({id:id(`${franchiseId}:transit:${store.id}`),franchise_id:franchiseId,store_id:store.id,request_id:null,status:"in_transit",delivery_method:"standard",notes:"Demo shipment in transit",distributed_by:actorId,received_by:null,dispatched_at:daysAgo(1,now),received_at:null,created_at:daysAgo(2,now),master_supply_distribution_items:items});
    });
    const statuses=["pending","pending","approved","rejected","fulfilled"];
    statuses.forEach((status,index)=>{
      const store=stores[index%stores.length], managerId=id(`${franchiseId}:manager:${store.id}`);
      const fulfilledItems=distributions.find(distribution=>distribution.store_id===store.id&&distribution.status==="delivered")?.master_supply_distribution_items;
      const requestItems=status==="fulfilled"&&fulfilledItems
        ? fulfilledItems.filter(item=>item.quantity>0).map(item=>({product_id:item.product_id,requested_quantity:item.quantity,approved_quantity:item.quantity}))
        : [{product_id:products[index%products.length].id,requested_quantity:30+index*5,approved_quantity:status==="approved"?30+index*5:status==="rejected"?0:null}];
      requests.push({id:id(`${franchiseId}:request:${index}`),franchise_id:franchiseId,store_id:store.id,requested_by:managerId,status,notes:`Demo store replenishment request ${index+1}`,created_at:daysAgo(index+1,now),reviewed_at:status==="pending"?null:daysAgo(index,now),master_supply_request_items:requestItems});
    });
    const fulfilled=requests.find(request=>request.status==="fulfilled");
    const delivered=distributions.find(distribution=>distribution.store_id===fulfilled?.store_id&&distribution.status==="delivered");
    if(delivered&&fulfilled) delivered.request_id=fulfilled.id;
    for(const distribution of distributions) if(distribution.status==="delivered"||distribution.status==="in_transit")
      for(const item of distribution.master_supply_distribution_items) products.find(product=>product.id===item.product_id)!.on_hand-=item.quantity;
  }
  return {franchiseId,products,stores,requests,distributions,stocks,allocations,receipts,restocks:[],adjustments:[],names,demo:true};
}

const directory=path.join(process.cwd(),".local","master-supply-demo");
export function supplyDemoFilePath(actorId:string,franchiseId:string) {
  return path.join(directory,`${createHash("sha256").update(`${actorId}:${franchiseId}`).digest("hex")}.json`);
}
async function readSaved(actorId:string,franchiseId:string) {
  try { return JSON.parse(await readFile(supplyDemoFilePath(actorId,franchiseId),"utf8")) as SupplySnapshot; }
  catch(error) { if((error as NodeJS.ErrnoException).code==="ENOENT") return null; throw error; }
}
export async function readSupplyDemoSnapshot(actorId:string,franchiseId:string,stores:SupplyStore[]) {
  const saved=await readSaved(actorId,franchiseId);
  const snapshot=saved??createSupplyDemoSnapshot(franchiseId,actorId,stores);
  const allowed=new Set(stores.map(store=>store.id));
  return {...snapshot,demo:true,stores,requests:snapshot.requests.filter(row=>allowed.has(row.store_id)),distributions:snapshot.distributions.filter(row=>allowed.has(row.store_id)),stocks:snapshot.stocks.filter(row=>allowed.has(row.store_id)),allocations:snapshot.allocations.filter(row=>allowed.has(row.store_id)).map(row=>{
    // Older local demo snapshots predate sale-item details. Their seeded sales
    // use the corresponding demo product's unit price.
    const product=snapshot.products.find(product=>product.id===row.master_product_id);
    return {...row,pos_sale_items:row.pos_sale_items??(product?{quantity:row.quantity,line_total:row.quantity*product.price}:null)};
  })};
}
const queues=new Map<string,Promise<unknown>>();
export async function updateSupplyDemoSnapshot<T>(actorId:string,franchiseId:string,stores:SupplyStore[],update:(snapshot:SupplySnapshot)=>T) {
  const file=supplyDemoFilePath(actorId,franchiseId);
  const previous=queues.get(file)??Promise.resolve();
  const next=previous.catch(()=>undefined).then(async()=>{
    const snapshot=await readSupplyDemoSnapshot(actorId,franchiseId,stores);
    const result=update(snapshot);
    await mkdir(directory,{recursive:true});
    const temporary=`${file}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary,JSON.stringify(snapshot),"utf8");
    await rename(temporary,file);
    return result;
  });
  queues.set(file,next);
  try { return await next; } finally { if(queues.get(file)===next) queues.delete(file); }
}
