"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFranchiseAdmin } from "@/lib/franchise/auth";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { isSupplyDemoAccount, updateSupplyDemoSnapshot } from "@/lib/master-supply/demo-data";
import { applySupplyDemoAction } from "@/lib/master-supply/demo-action";
import { getFranchiseSupplySnapshot } from "@/lib/master-supply/data";
import { PRODUCT_CATEGORIES } from "@/lib/manager/options";
import { masterProductImageObjectPath, normalizeProductImage } from "@/lib/product-image-upload";
import { masterSupplySku } from "@/lib/master-supply/sku";
import { supplyRequestSchema } from "@/lib/manager/supply-request-model";
import { requireManagerSupplyContext } from "@/lib/manager/supply-requests";

const uuid = z.string().uuid();
const quantity = z.number().int().min(1).max(1_000_000);
const item = z.object({ productId: uuid, quantity }).strict();
const imageUrl = z.string().trim().max(1000).refine(value => !value || value.startsWith("/") || /^https:\/\//i.test(value), "Use an HTTPS image URL or a local image path.");
const schemas = {
  create_product: z.object({ id: uuid, sku: z.string().trim().min(2).max(60), name: z.string().trim().min(2).max(120),
    category: z.enum(PRODUCT_CATEGORIES), subcategory: z.string().trim().max(80),
    strainType: z.string().trim().max(80), cultivationType: z.string().trim().max(80),
    price: z.number().positive().max(1_000_000), supplierCostPrice: z.number().positive().max(1_000_000).optional(), imageUrl,
    description: z.string().trim().max(2000), quantity }).strict(),
  add_stock: z.object({ id: uuid, productId: uuid, quantity, reason: z.string().trim().max(500) }).strict(),
  adjust_central: z.object({ id: uuid, productId: uuid, delta: z.number().int().min(-1_000_000).max(1_000_000).refine(value => value !== 0), reason: z.string().trim().min(5).max(500) }).strict(),
  request: supplyRequestSchema,
  review_request: z.object({ requestId: uuid, decision: z.enum(["approve","partial","reject"]), rejectionReason: z.string().trim().max(500).optional(), items: z.array(z.object({ productId: uuid, quantity: z.number().int().min(0).max(1_000_000) }).strict()).max(100) }).strict(),
  distribute: z.object({ id: uuid, storeId: uuid, requestId: uuid.nullable(), deliveryMethod: z.enum(["standard","collection"]),
    notes: z.string().trim().max(500), items: z.array(item).min(1).max(100) }).strict(),
  dispatch: z.object({ distributionId: uuid }).strict(),
  cancel: z.object({ distributionId: uuid }).strict(),
  demo_receive: z.object({ distributionId: uuid }).strict(),
  receive: z.object({ distributionId: uuid, items: z.array(z.object({ productId: uuid, quantity: z.number().int().min(0).max(1_000_000) }).strict()).min(1).max(100) }).strict(),
  restock_refund: z.object({ id: uuid, saleItemId: uuid, quantity, reason: z.string().trim().min(5).max(500), conditionConfirmed: z.literal(true) }).strict()
} as const;

export type SupplyAction = keyof typeof schemas;
type CreateProductPayload = z.infer<typeof schemas.create_product>;

function createProductFormPayload(form: FormData): CreateProductPayload {
  const id = String(form.get("id") ?? "");
  const category = String(form.get("category") ?? "");
  return schemas.create_product.parse({
    id, sku: masterSupplySku(category,id), name: String(form.get("name") ?? ""), category,
    subcategory: String(form.get("subcategory") ?? ""), strainType: String(form.get("strainType") ?? ""),
    cultivationType: String(form.get("cultivationType") ?? ""), price: Number(form.get("price")),
    supplierCostPrice: Number(form.get("supplierCostPrice")), imageUrl: "", description: "",
    quantity: Number(form.get("quantity"))
  });
}

export async function masterSupplyAction(action: SupplyAction, input: unknown): Promise<{ ok: true; id: string; sku?: string; imageUrl?: string; supplierCostPrice?: number } | { ok: false; message: string }> {
  let uploadedPath: string | null = null;
  let persisted = false;
  try {
    await verifyOrigin();
    if (!(action in schemas)) throw new Error("Unknown Master Supply action.");
    const createForm = action === "create_product" && input instanceof FormData ? input : null;
    const payload = createForm ? createProductFormPayload(createForm) : schemas[action].parse(input);
    const createPayload = action === "create_product" ? payload as CreateProductPayload : null;
    let actor: string;
    let demoFranchiseId: string | null = null;
    let franchiseId: string | null = null;
    if (action === "request" || action === "receive" || action === "restock_refund") {
      const session = await requireCompletedManagerDashboardSession();
      if (session.profile.role !== "manager" || !session.assignedStoreId) throw new Error("Store manager access required.");
      actor = session.authUserId;
      if (action === "request") {
        const context = await requireManagerSupplyContext();
        if ((payload as z.infer<typeof supplyRequestSchema>).expectedStoreId !== context.store_id) throw new Error("Active store changed. Reload your request.");
      }
    } else {
      const { session, franchiseId: assignedFranchiseId } = await requireFranchiseAdmin();
      actor = session.authUserId;
      franchiseId = assignedFranchiseId;
      if(isSupplyDemoAccount(session)) demoFranchiseId=assignedFranchiseId;
    }
    await assertRateLimit(`master-supply:${actor}`, 40, 60_000);
    if(action==="demo_receive"&&!demoFranchiseId) throw new Error("Demo receipt is available only in the local Franchise Admin demo.");
    const existingDemoSnapshot = demoFranchiseId && createForm ? await getFranchiseSupplySnapshot("overview") : null;
    const existingDemoProduct = existingDemoSnapshot?.products.find(product=>product.id===createPayload?.id);
    if(existingDemoProduct) return {ok:true,id:existingDemoProduct.id,sku:existingDemoProduct.sku,imageUrl:existingDemoProduct.image_url??undefined,supplierCostPrice:existingDemoProduct.supplier_cost_price??undefined};
    let client = createForm ? createSupabaseAdminClient() : null;
    if(createForm && !demoFranchiseId && !client) throw new Error("Master Supply database is unavailable.");
    if(createForm && !demoFranchiseId && client && createPayload) {
      const {data:existing,error:lookupError}=await client.from("master_supply_products").select("id,sku,image_url,supplier_cost_price").eq("id",createPayload.id).eq("franchise_id",franchiseId!).maybeSingle();
      if(lookupError) throw new Error("Master product could not be checked.");
      if(existing) return {ok:true,id:existing.id,sku:existing.sku,imageUrl:existing.image_url??undefined,supplierCostPrice:existing.supplier_cost_price??undefined};
    }
    const imageFile = createForm?.get("productImage");
    if(imageFile instanceof File && imageFile.size > 0 && createPayload) {
      if(!client) throw new Error("Product image storage is unavailable.");
      const image=await normalizeProductImage(imageFile);
      uploadedPath=masterProductImageObjectPath(franchiseId!,createPayload.id);
      const {error:uploadError}=await client.storage.from("product-images").upload(uploadedPath,image.data,{upsert:false,contentType:image.contentType,cacheControl:"31536000"});
      if(uploadError) throw new Error("Product image could not be uploaded.");
      createPayload.imageUrl=client.storage.from("product-images").getPublicUrl(uploadedPath).data.publicUrl;
    }
    if(demoFranchiseId) {
      const snapshot=existingDemoSnapshot??await getFranchiseSupplySnapshot("overview");
      const id=await updateSupplyDemoSnapshot(actor,demoFranchiseId,snapshot.stores,demo=>applySupplyDemoAction(demo,action,payload,actor));
      persisted=true;
      revalidatePath("/dashboard/franchise/supply","layout");
      return {ok:true,id,sku:createPayload?.sku,imageUrl:createPayload?.imageUrl||undefined,supplierCostPrice:createPayload?.supplierCostPrice};
    }
    client ??= createSupabaseAdminClient();
    if (!client) throw new Error("Master Supply database is unavailable.");
    const { data, error } = createPayload?.supplierCostPrice !== undefined
      ? await client.rpc("master_supply_create_product_with_cost",{p_actor:actor,p_data:payload})
      : await client.rpc("master_supply_mutation", { p_actor: actor, p_action: action, p_data: payload });
    if (error) throw new Error(action === "request" ? "Your request could not be submitted. Refresh the catalogue and retry." : error.message);
    persisted=true;
    revalidatePath("/dashboard/franchise/supply", "layout");
    revalidatePath("/dashboard/manager/supply");
    revalidatePath("/dashboard/manager/suppliers", "layout");
    revalidatePath("/dashboard/manager/inventory");
    revalidatePath("/dashboard/receptionist/products");
    return { ok: true, id: String(data),sku:createPayload?.sku,imageUrl:createPayload?.imageUrl||undefined,supplierCostPrice:createPayload?.supplierCostPrice };
  } catch (error) {
    if(uploadedPath&&!persisted) {
      try { await createSupabaseAdminClient()?.storage.from("product-images").remove([uploadedPath]); } catch { /* Keep the original error. */ }
    }
    return { ok: false, message: error instanceof z.ZodError ? error.issues[0]?.message ?? "Check the form." : error instanceof Error ? error.message : "Master Supply action failed." };
  }
}
