import type { SupplyAction } from "@/app/dashboard/franchise/supply/actions";
import type { SupplySnapshot } from "./data";

type Item = { productId:string; quantity:number };
type DemoInput = { id?:string; productId?:string; quantity?:number; delta?:number; reason?:string; sku?:string; name?:string; category?:string; subcategory?:string; strainType?:string; cultivationType?:string; price?:number; supplierCostPrice?:number; imageUrl?:string; description?:string; requestId?:string|null; decision?:string; rejectionReason?:string; items?:Item[]; storeId?:string; deliveryMethod?:string; notes?:string; distributionId?:string };
const fail=(message:string):never=>{throw new Error(message);};
const required=(value:string|undefined,label:string)=>value??fail(`${label} is required.`);

export function applySupplyDemoAction(snapshot:SupplySnapshot, action:SupplyAction, input:unknown, actorId:string, now=new Date()):string {
  const data=input as DemoInput, stamp=now.toISOString();
  if(action==="create_product") {
    const productId=required(data.id,"Product ID"), sku=required(data.sku,"SKU");
    if(snapshot.products.some(product=>product.id===productId)) return productId;
    if(snapshot.products.some(product=>product.sku.toLowerCase()===sku.toLowerCase())) fail("That SKU already exists.");
    const same=(left:string|null|undefined,right:string|null|undefined)=>(left??"").trim().toLowerCase()===(right??"").trim().toLowerCase();
    if(snapshot.products.some(product=>same(product.name,data.name)&&same(product.category,data.category)&&same(product.subcategory,data.subcategory)&&same(product.strain_type,data.strainType)&&same(product.cultivation_type,data.cultivationType))) fail("This product already exists. Select it to add supply.");
    const amount=data.quantity??0;
    snapshot.products.push({id:productId,franchise_id:snapshot.franchiseId,sku,name:required(data.name,"Product name"),category:required(data.category,"Category"),subcategory:data.subcategory??"",strain_type:data.strainType||null,cultivation_type:data.cultivationType||null,price:data.price??0,supplier_cost_price:data.supplierCostPrice??null,image_url:data.imageUrl||null,description:data.description??"",on_hand:amount,reserved:0,total_received:amount,last_received_at:amount?stamp:null,created_at:stamp});
    if(amount) snapshot.receipts.unshift({id:crypto.randomUUID(),product_id:productId,quantity:amount,reason:"Demo supply received",created_at:stamp,actor_id:actorId});
    return productId;
  }
  if(action==="add_stock"||action==="adjust_central") {
    const product=snapshot.products.find(row=>row.id===data.productId);
    if(!product) throw new Error("Product not found.");
    if(action==="add_stock") {
      if(snapshot.receipts.some(receipt=>receipt.id===data.id)) return product.id;
      const quantity=data.quantity??0;
      product.on_hand+=quantity; product.total_received+=quantity; product.last_received_at=stamp;
      snapshot.receipts.unshift({id:required(data.id,"Receipt ID"),product_id:product.id,quantity,reason:data.reason??"Demo stock received",created_at:stamp,actor_id:actorId});
    } else {
      if(snapshot.adjustments.some(adjustment=>adjustment.id===data.id)) return product.id;
      const previous=product.on_hand, delta=data.delta??0;
      if(previous+delta<product.reserved) fail("Adjustment would reduce stock below reserved supply.");
      product.on_hand+=delta;
      snapshot.adjustments.unshift({id:required(data.id,"Adjustment ID"),product_id:product.id,delta,previous_quantity:previous,new_quantity:product.on_hand,reason:data.reason??"",created_at:stamp});
    }
    return product.id;
  }
  if(action==="review_request") {
    const request=snapshot.requests.find(row=>row.id===data.requestId);
    if(!request||!["pending","approved","partially_approved"].includes(request.status)) throw new Error("Request cannot be reviewed.");
    if(snapshot.distributions.some(row=>row.request_id===request.id)) fail("Request already converted.");
    if(data.decision==="reject") {
      request.status="rejected";
      request.rejection_reason=data.rejectionReason?.trim() || "";
      request.master_supply_request_items.forEach(item=>item.approved_quantity=0);
    } else if(data.decision==="approve") {
      request.status="approved";
      request.master_supply_request_items.forEach(item=>item.approved_quantity=item.requested_quantity);
    } else {
      const approved=new Map((data.items??[]).map(item=>[item.productId,item.quantity]));
      for(const item of request.master_supply_request_items) {
        const amount=approved.get(item.product_id)??0;
        if(amount<0||amount>item.requested_quantity) fail("Approved quantity exceeds the request.");
        item.approved_quantity=amount;
      }
      if(!request.master_supply_request_items.some(item=>(item.approved_quantity??0)>0)) fail("Approve at least one unit.");
      request.status=request.master_supply_request_items.some(item=>(item.approved_quantity??0)<item.requested_quantity)?"partially_approved":"approved";
    }
    request.reviewed_at=stamp;
    return request.id;
  }
  if(action==="distribute") {
    const store=snapshot.stores.find(row=>row.id===data.storeId);
    if(!store) throw new Error("Store not found in your franchise.");
    const distributionId=required(data.id,"Distribution ID");
    if(snapshot.distributions.some(row=>row.id===distributionId)) return distributionId;
    const request=data.requestId?snapshot.requests.find(row=>row.id===data.requestId):null;
    if(data.requestId&&(!request||request.store_id!==store.id||!["approved","partially_approved"].includes(request.status))) fail("This request is not eligible for distribution.");
    if(request&&snapshot.distributions.some(row=>row.request_id===request.id)) fail("Request already converted.");
    const seen=new Set<string>();
    const items=(data.items??[]).map(item=>{
      if(seen.has(item.productId)) fail("Select each product only once.");
      seen.add(item.productId);
      const product=snapshot.products.find(row=>row.id===item.productId);
      if(!product) throw new Error("Product not found.");
      if(product.on_hand-product.reserved<item.quantity) fail("Quantity exceeds available central stock.");
      if(request&&(request.master_supply_request_items.find(row=>row.product_id===item.productId)?.approved_quantity??0)<item.quantity) fail("Quantity exceeds the approved request.");
      return {product_id:product.id,quantity:item.quantity,received_quantity:null};
    });
    if(!items.length) fail("Select at least one product.");
    for(const item of items) snapshot.products.find(product=>product.id===item.product_id)!.reserved+=item.quantity;
    snapshot.distributions.unshift({id:distributionId,franchise_id:snapshot.franchiseId,store_id:store.id,request_id:request?.id??null,status:"reserved",delivery_method:data.deliveryMethod??"standard",notes:data.notes??"",distributed_by:actorId,received_by:null,dispatched_at:null,received_at:null,created_at:stamp,master_supply_distribution_items:items});
    return distributionId;
  }
  if(action==="dispatch"||action==="cancel") {
    const distribution=snapshot.distributions.find(row=>row.id===data.distributionId);
    if(!distribution||distribution.status!=="reserved") throw new Error("Only reserved distributions can be updated.");
    for(const item of distribution.master_supply_distribution_items) {
      const product=snapshot.products.find(row=>row.id===item.product_id)!;
      product.reserved-=item.quantity;
      if(action==="dispatch") product.on_hand-=item.quantity;
    }
    distribution.status=action==="dispatch"?"in_transit":"cancelled";
    if(action==="dispatch") distribution.dispatched_at=stamp;
    return distribution.id;
  }
  if(action==="demo_receive") {
    const distribution=snapshot.distributions.find(row=>row.id===data.distributionId);
    if(!distribution||distribution.status!=="in_transit") throw new Error("Only in-transit demo distributions can be received.");
    for(const item of distribution.master_supply_distribution_items) {
      item.received_quantity=item.quantity;
      let stock=snapshot.stocks.find(row=>row.store_id===distribution.store_id&&row.master_product_id===item.product_id);
      if(!stock) {
        stock={store_id:distribution.store_id,franchise_id:snapshot.franchiseId,master_product_id:item.product_id,product_id:crypto.randomUUID(),quantity:0,received_total:0,sold_total:0};
        snapshot.stocks.push(stock);
      }
      stock.quantity+=item.quantity;
      stock.received_total+=item.quantity;
    }
    distribution.status="delivered";
    distribution.received_at=stamp;
    distribution.received_by=actorId;
    const request=snapshot.requests.find(row=>row.id===distribution.request_id);
    if(request) request.status="fulfilled";
    return distribution.id;
  }
  throw new Error("This action is unavailable in the Franchise Admin demo.");
}
