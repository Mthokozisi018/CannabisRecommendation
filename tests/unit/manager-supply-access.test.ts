import { afterEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({session:vi.fn(),rpc:vi.fn(),from:vi.fn(),adminFrom:vi.fn(),origin:vi.fn(),limit:vi.fn(),adminRpc:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("react",()=>({cache:(fn:unknown)=>fn}));
vi.mock("@/lib/manager/onboarding",()=>({requireCompletedManagerDashboardSession:mocks.session}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({rpc:mocks.rpc,from:mocks.from}),createSupabaseAdminClient:()=>({rpc:mocks.adminRpc,from:mocks.adminFrom})}));
vi.mock("@/lib/security",()=>({verifyOrigin:mocks.origin,assertRateLimit:mocks.limit}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/franchise/auth",()=>({requireFranchiseAdmin:vi.fn()}));
import { getManagerSupplyContext, getManagerSupplyRequests } from "@/lib/manager/supply-requests";
import { masterSupplyAction } from "@/app/dashboard/franchise/supply/actions";
const store="20000000-0000-4000-8000-000000000001",product="30000000-0000-4000-8000-000000000001";
const context={store_id:store,store_name:"Store",franchise_id:"franchise",franchise_name:"Franchise"};
function session(){mocks.session.mockResolvedValue({authUserId:"manager",assignedStoreId:store,profile:{role:"manager"}});}
afterEach(()=>vi.resetAllMocks());
it("fails closed for independent, unverified and mismatched active stores",async()=>{
  session();
  for(const data of [[],[{...context,store_id:"another"}]]) {
    mocks.rpc.mockResolvedValue({data,error:null});
    expect(await getManagerSupplyContext()).toBeNull();
    await expect(getManagerSupplyRequests()).rejects.toThrow(/verified franchise/);
  }
  mocks.rpc.mockResolvedValue({data:null,error:{message:"Database unavailable"}});
  expect(await getManagerSupplyContext()).toBeNull();
  expect(mocks.from).not.toHaveBeenCalled();
});
it("enforces authentication before fetching supply data",async()=>{
  mocks.session.mockRejectedValue(new Error("Authentication required"));
  await expect(getManagerSupplyRequests()).rejects.toThrow(/Authentication/);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("scopes every request query and strips unexpected private catalogue fields before serialization",async()=>{
  session();
  const eq=vi.fn();
  const query={select:vi.fn(),eq,order:vi.fn(),range:vi.fn().mockResolvedValue({data:[],error:null})};
  query.select.mockReturnValue(query);eq.mockReturnValue(query);query.order.mockReturnValue(query);mocks.from.mockReturnValue(query);
  mocks.rpc.mockImplementation((name:string)=> name==="manager_supply_context" ? Promise.resolve({data:[context],error:null}) : {range:()=>Promise.resolve({data:[{id:product,sku:"S",name:"Product",category:"Flower",subcategory:"Sativa",strain_type:"Sativa",cultivation_type:"Indoor",image_url:null,available:true,on_hand:871,reserved:33,supplier_cost_price:920,total_received:2000}],error:null})});
  const data=await getManagerSupplyRequests();
  expect(eq).toHaveBeenCalledWith("store_id",store);expect(eq).toHaveBeenCalledWith("franchise_id","franchise");
  expect(Object.keys(data.products[0]).sort()).toEqual(["id","sku","name","category","subcategory","strain_type","cultivation_type","image_url","available"].sort());
  expect(JSON.stringify(data)).not.toMatch(/on_hand|reserved|supplier_cost_price|total_received/);
});
it("uses verified franchise and store relationships when the staging catalogue RPC is unavailable",async()=>{
  session();
  const adminEq=vi.fn();
  const rows:Record<string,unknown>={
    stores:{id:store,name:"Store",franchise_id:"franchise"},
    staff_profiles:{id:"franchise-admin"},
    franchises:{id:"franchise",name:"Franchise"},
    master_supply_products:[{id:product,sku:"S",name:"Product",category:"Flower",subcategory:"Sativa",strain_type:"Sativa",cultivation_type:"Indoor",image_url:null,on_hand:20,reserved:5,supplier_cost_price:920}]
  };
  mocks.adminFrom.mockImplementation((table:string)=>{
    const query={select:vi.fn(),eq:adminEq,order:vi.fn(),limit:vi.fn(),maybeSingle:vi.fn(),range:vi.fn()};
    query.select.mockReturnValue(query);adminEq.mockReturnValue(query);query.order.mockReturnValue(query);query.limit.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({data:rows[table],error:null});query.range.mockResolvedValue({data:rows[table],error:null});
    return query;
  });
  mocks.rpc.mockImplementation((name:string)=>name==="manager_supply_context"
    ? Promise.resolve({data:null,error:{code:"PGRST202"}})
    : {range:()=>Promise.resolve({data:null,error:{code:"PGRST202"}})});
  const query={select:vi.fn(),eq:vi.fn(),order:vi.fn(),range:vi.fn().mockResolvedValue({data:[],error:null})};
  query.select.mockReturnValue(query);query.eq.mockReturnValue(query);query.order.mockReturnValue(query);mocks.from.mockReturnValue(query);
  const data=await getManagerSupplyRequests();
  expect(data.context).toEqual(context);
  expect(adminEq).toHaveBeenCalledWith("franchise_id","franchise");
  expect(data.products).toEqual([{id:product,sku:"S",name:"Product",category:"Flower",subcategory:"Sativa",strain_type:"Sativa",cultivation_type:"Indoor",image_url:null,available:true}]);
  expect(JSON.stringify(data)).not.toMatch(/on_hand|reserved|supplier_cost_price/);
});
it("denies legacy catalogue access when the store has no verified franchise administrator",async()=>{
  session();
  mocks.rpc.mockResolvedValue({data:null,error:{code:"PGRST202"}});
  mocks.adminFrom.mockImplementation((table:string)=>{
    const query={select:vi.fn(),eq:vi.fn(),limit:vi.fn(),maybeSingle:vi.fn()};
    query.select.mockReturnValue(query);query.eq.mockReturnValue(query);query.limit.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({data:table==="stores"?{id:store,name:"Store",franchise_id:"franchise"}:null,error:null});
    return query;
  });
  expect(await getManagerSupplyContext()).toBeNull();
  await expect(getManagerSupplyRequests()).rejects.toThrow(/verified franchise/);
  expect(mocks.adminFrom).not.toHaveBeenCalledWith("master_supply_products");
});
it("rejects tampered submission context and duplicate products before calling the service mutation",async()=>{
  session();mocks.rpc.mockResolvedValue({data:[context],error:null});
  const base={id:crypto.randomUUID(),expectedStoreId:store,notes:"",items:[{productId:product,quantity:1}]};
  for(const payload of [{...base,expectedStoreId:crypto.randomUUID()},{...base,items:[...base.items,...base.items]},{...base,franchiseId:"foreign"}]) {
    expect((await masterSupplyAction("request",payload)).ok).toBe(false);
  }
  expect(mocks.adminRpc).not.toHaveBeenCalled();
});
it("uses the existing transactional request mutation and returns no database quantities on failure",async()=>{
  session();mocks.rpc.mockResolvedValue({data:[context],error:null});
  const payload={id:crypto.randomUUID(),expectedStoreId:store,notes:"",items:[{productId:product,quantity:999}]};
  mocks.adminRpc.mockResolvedValueOnce({data:payload.id,error:null}).mockResolvedValueOnce({data:null,error:{message:"on_hand 17 reserved 8 supplier_cost_price 120"}});
  expect(await masterSupplyAction("request",payload)).toMatchObject({ok:true,id:payload.id});
  expect(mocks.adminRpc).toHaveBeenCalledWith("master_supply_mutation",{p_actor:"manager",p_action:"request",p_data:payload});
  const result=await masterSupplyAction("request",payload);
  expect(result.ok).toBe(false);expect(JSON.stringify(result)).not.toMatch(/17|reserved|supplier_cost_price|120/);
});
