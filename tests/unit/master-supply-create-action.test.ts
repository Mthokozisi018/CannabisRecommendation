// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { masterSupplyAction } from "@/app/dashboard/franchise/supply/actions";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { normalizeProductImage } from "@/lib/product-image-upload";

vi.mock("server-only",()=>({}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/franchise/auth",()=>({requireFranchiseAdmin:vi.fn(async()=>({session:{authUserId:"actor"},franchiseId:"franchise"}))}));
vi.mock("@/lib/manager/onboarding",()=>({requireCompletedManagerDashboardSession:vi.fn()}));
vi.mock("@/lib/security",()=>({verifyOrigin:vi.fn(async()=>{}),assertRateLimit:vi.fn(async()=>{})}));
vi.mock("@/lib/master-supply/demo-data",()=>({isSupplyDemoAccount:vi.fn(()=>false),updateSupplyDemoSnapshot:vi.fn()}));
vi.mock("@/lib/master-supply/data",()=>({getFranchiseSupplySnapshot:vi.fn()}));
vi.mock("@/lib/product-image-upload",()=>({
  normalizeProductImage:vi.fn(async()=>({data:new Uint8Array([1,2,3]),contentType:"image/webp",extension:"webp",width:10,height:10})),
  masterProductImageObjectPath:vi.fn(()=>"franchises/franchise/master-products/product/image.webp")
}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseAdminClient:vi.fn()}));

const upload=vi.fn();
const remove=vi.fn();
const rpc=vi.fn();
const maybeSingle=vi.fn();
beforeEach(()=>{
  vi.clearAllMocks();
  upload.mockResolvedValue({error:null});
  remove.mockResolvedValue({error:null});
  rpc.mockResolvedValue({data:"10000000-0000-4000-8000-000000000001",error:null});
  maybeSingle.mockResolvedValue({data:null,error:null});
  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle})})})}),
    storage:{from:()=>({upload,remove,getPublicUrl:()=>({data:{publicUrl:"https://example.com/image.webp"}})})},
    rpc
  } as unknown as NonNullable<ReturnType<typeof createSupabaseAdminClient>>);
});

function form(withImage=true){
  const data=new FormData();
  data.set("id","10000000-0000-4000-8000-000000000001");
  data.set("name","New Hybrid Flower");
  data.set("category","Flower");
  data.set("subcategory","Hybrid");
  data.set("strainType","Hybrid");
  data.set("cultivationType","Indoor");
  data.set("supplierCostPrice","82.50");
  data.set("price","150.00");
  data.set("quantity","12");
  if(withImage)data.set("productImage",new File(["image"],"flower.png",{type:"image/png"}));
  return data;
}

it("generates the SKU and saves the image, cost and initial stock together",async()=>{
  const result=await masterSupplyAction("create_product",form());
  expect(result).toMatchObject({ok:true,sku:"GC-MS-FLW-100000000000",supplierCostPrice:82.5,imageUrl:"https://example.com/image.webp"});
  expect(normalizeProductImage).toHaveBeenCalledOnce();
  expect(upload).toHaveBeenCalledWith("franchises/franchise/master-products/product/image.webp",expect.anything(),expect.objectContaining({contentType:"image/webp",upsert:false}));
  expect(rpc).toHaveBeenCalledWith("master_supply_create_product_with_cost",expect.objectContaining({p_actor:"actor",p_data:expect.objectContaining({sku:"GC-MS-FLW-100000000000",supplierCostPrice:82.5,price:150,quantity:12,imageUrl:"https://example.com/image.webp",description:""})}));
  expect(remove).not.toHaveBeenCalled();
});

it("removes the uploaded object if product creation fails",async()=>{
  rpc.mockResolvedValue({data:null,error:{message:"Duplicate product"}});
  const result=await masterSupplyAction("create_product",form());
  expect(result).toMatchObject({ok:false,message:"Duplicate product"});
  expect(remove).toHaveBeenCalledWith(["franchises/franchise/master-products/product/image.webp"]);
});

it("creates a product with no image and retains its category placeholder",async()=>{
  const result=await masterSupplyAction("create_product",form(false));
  expect(result).toMatchObject({ok:true,imageUrl:undefined});
  expect(upload).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith("master_supply_create_product_with_cost",expect.objectContaining({p_data:expect.objectContaining({imageUrl:""})}));
});

it("reuses a completed product on retry without uploading another image",async()=>{
  maybeSingle.mockResolvedValue({data:{id:"10000000-0000-4000-8000-000000000001",sku:"GC-MS-FLW-100000000000",image_url:"https://example.com/saved.webp",supplier_cost_price:82.5},error:null});
  const result=await masterSupplyAction("create_product",form());
  expect(result).toMatchObject({ok:true,imageUrl:"https://example.com/saved.webp"});
  expect(upload).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
