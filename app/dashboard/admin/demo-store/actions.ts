"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CheckoutInput, CheckoutResult } from "@/app/dashboard/receptionist/actions";
import type { ManagerActionState } from "@/app/dashboard/manager/actions";
import { edibleThcDatabaseFields, type ManagerInventoryProduct } from "@/lib/manager/data";
import { categoryAllowsCultivationType, categoryAllowsProductImageOnCreate, VAPE_PRODUCT_TYPES, VAPE_STRAIN_TYPES } from "@/lib/manager/options";
import { inventoryAddSchema, productEditSchema, productFormSchema, type InventoryAddInput, type ProductEditInput, type ProductFormInput } from "@/lib/manager/validation";
import { normalizeProductImage, productImageObjectPath, type NormalizedProductImage } from "@/lib/product-image-upload";
import { requireAdminDemoClient, requireAdminDemoStoreContext } from "@/lib/admin/demo-store";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const productImageBucket = "product-images";
const missingProductDatabaseMessage = "Product database tables are not set up yet. Please apply Supabase migrations.";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const visibilitySchema = z.object({
  productId: z.string().uuid("Product is required"),
  isVisibleOnPos: z.enum(["true", "false"])
});

const productArchiveSchema = z.object({
  productId: z.string().uuid("Product is required")
});

function demoActionMessage(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  if (!(error instanceof Error)) return fallback;
  const lower = error.message.toLowerCase();
  if (lower.includes("schema cache") || lower.includes("could not find the table") || lower.includes("does not exist")) {
    return missingProductDatabaseMessage;
  }
  return error.message;
}

async function validatedProductImage(formData: FormData) {
  const image = formData.get("productImage");
  if (!(image instanceof File) || image.size === 0) return null;
  return normalizeProductImage(image);
}

function removeImageRequested(formData: FormData) {
  return text(formData, "removeProductImage") === "1";
}

async function uploadProductImage(input: { storeId: string; productId: string; image: NormalizedProductImage }) {
  const admin = requireAdminDemoClient();
  const imagePath = productImageObjectPath(input.storeId, input.productId);
  const { error: uploadError } = await admin.storage.from(productImageBucket).upload(imagePath, input.image.data, {
    upsert: false,
    contentType: input.image.contentType,
    cacheControl: "31536000"
  });
  if (uploadError) throw new Error("Product image could not be uploaded.");
  const { data: publicUrl } = admin.storage.from(productImageBucket).getPublicUrl(imagePath);
  return { imagePath, imageUrl: publicUrl.publicUrl };
}

async function updateProductImageReference(input: { storeId: string; productId: string; imagePath: string; imageUrl: string; oldImagePath?: string | null }) {
  const admin = requireAdminDemoClient();
  const { error } = await admin
    .from("products")
    .update({ image_bucket: productImageBucket, image_path: input.imagePath, image_url: input.imageUrl })
    .eq("id", input.productId)
    .eq("store_id", input.storeId)
    .is("deleted_at", null);
  if (error) {
    await admin.storage.from(productImageBucket).remove([input.imagePath]);
    throw new Error("Product image could not be saved.");
  }
  if (input.oldImagePath && input.oldImagePath !== input.imagePath) await admin.storage.from(productImageBucket).remove([input.oldImagePath]);
}

async function clearProductImageReference(input: { storeId: string; productId: string; oldImagePath?: string | null }) {
  const admin = requireAdminDemoClient();
  const { error } = await admin
    .from("products")
    .update({ image_bucket: null, image_path: null, image_url: null })
    .eq("id", input.productId)
    .eq("store_id", input.storeId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  if (input.oldImagePath) await admin.storage.from(productImageBucket).remove([input.oldImagePath]);
}

function isCanonicalVapeSelection(input: { category: string; subcategory: string }) {
  return input.category === "Vape Cartridges" && VAPE_PRODUCT_TYPES.includes(input.subcategory as never);
}

function selectedProductMatchesFilters(product: { category: string | null; subcategory: string | null; cultivation_type: string | null }, parsed: { category: string; subcategory: string; cultivationType?: string }) {
  if (isCanonicalVapeSelection(parsed)) {
    const selectedStrain = parsed.cultivationType ?? "";
    if (!VAPE_STRAIN_TYPES.includes(selectedStrain as never)) return false;
    const canonicalMatch = product.category === "Vape Cartridges" && product.subcategory === parsed.subcategory && product.cultivation_type === selectedStrain;
    const legacyRegularMatch = parsed.subcategory === "Vape Cartridge" && product.category === "Vape Cartridges" && product.subcategory === selectedStrain && product.cultivation_type === null;
    const legacyDisposableMatch = parsed.subcategory === "Disposable Vape" && product.category === "Disposable Vapes" && product.subcategory === selectedStrain && product.cultivation_type === null;
    return canonicalMatch || legacyRegularMatch || legacyDisposableMatch;
  }

  return product.category === parsed.category &&
    product.subcategory === parsed.subcategory &&
    ((!categoryAllowsCultivationType(parsed.category) && product.cultivation_type === null) ||
      (categoryAllowsCultivationType(parsed.category) && product.cultivation_type === parsed.cultivationType));
}

function revalidateDemoStorePaths() {
  revalidatePath("/dashboard/admin/demo-store");
  revalidatePath("/dashboard/admin/demo-store/manager");
  revalidatePath("/dashboard/admin/demo-store/manager/products");
  revalidatePath("/dashboard/admin/demo-store/manager/inventory");
  revalidatePath("/dashboard/admin/demo-store/manager/inventory/manage");
  revalidatePath("/dashboard/admin/demo-store/manager/products/edit");
  revalidatePath("/dashboard/admin/demo-store/manager/inventory/view");
  revalidatePath("/dashboard/admin/demo-store/receptionist");
}

async function ensureUniqueDemoProduct(input: { storeId: string; productName: string; category: string; subcategory: string; cultivationType: string | null; excludeProductId?: string }) {
  const admin = requireAdminDemoClient();
  let query = admin
    .from("products")
    .select("id")
    .eq("store_id", input.storeId)
    .ilike("product_name", input.productName)
    .eq("category", input.category)
    .eq("subcategory", input.subcategory)
    .is("deleted_at", null);

  query = input.cultivationType ? query.eq("cultivation_type", input.cultivationType) : query.is("cultivation_type", null);
  if (input.excludeProductId) query = query.neq("id", input.excludeProductId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (data) throw new Error("A matching demo product already exists in this store.");
}

async function auditDemoAction(action: string, tableName: string, recordId: string | null, details: Record<string, unknown>) {
  const context = await requireAdminDemoStoreContext();
  const admin = requireAdminDemoClient();
  await admin.from("audit_logs").insert({
    user_id: context.adminUserId,
    action,
    table_name: tableName,
    record_id: recordId,
    store_id: context.storeId,
    result: "completed",
    details: { ...details, storeId: context.storeId, demoStore: true }
  });
}

export async function createAdminDemoProductAction(_prev: ManagerActionState, formData: FormData): Promise<ManagerActionState> {
  try {
    await verifyOrigin();
    const context = await requireAdminDemoStoreContext();
    await assertRateLimit(`admin:demo-product-create:${context.adminUserId}`, 20, 60 * 60_000);
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const parsed = productFormSchema.parse({
      productName: text(formData, "productName"),
      category: text(formData, "category"),
      subcategory: text(formData, "subcategory"),
      cultivationType: text(formData, "cultivationType") || undefined,
      packageCount: text(formData, "packageCount"),
      thcPerUnitMg: text(formData, "thcPerUnitMg"),
      thcPerPacketMg: text(formData, "thcPerPacketMg"),
      price: text(formData, "price"),
      productStatus: text(formData, "productStatus"),
      initialStockQuantity: text(formData, "initialStockQuantity") || 0,
      lowStockThreshold: 5
    }) as ProductFormInput;

    const image = categoryAllowsProductImageOnCreate(parsed.category) ? await validatedProductImage(formData) : null;
    const parsedCultivationType = typeof parsed.cultivationType === "string" ? parsed.cultivationType : undefined;
    const cultivationType = isCanonicalVapeSelection(parsed) ? parsedCultivationType ?? null : categoryAllowsCultivationType(parsed.category) ? parsedCultivationType ?? null : null;

    await ensureUniqueDemoProduct({
      storeId: context.storeId,
      productName: parsed.productName,
      category: parsed.category,
      subcategory: parsed.subcategory,
      cultivationType
    });

    const { data: productData, error: productError } = await supabase.rpc("create_product_with_inventory", {
      p_store_id: context.storeId,
      p_product_name: parsed.productName,
      p_category: parsed.category,
      p_subcategory: parsed.subcategory,
      p_cultivation_type: cultivationType,
      p_price: parsed.price,
      p_product_status: parsed.productStatus,
      p_package_count: parsed.packageCount ?? null,
      p_thc_per_unit_mg: parsed.thcPerUnitMg ?? null,
      p_thc_per_packet_mg: parsed.thcPerPacketMg ?? null,
      p_initial_stock: parsed.initialStockQuantity,
      p_low_stock_threshold: parsed.lowStockThreshold
    });
    if (productError) throw new Error("Demo product and inventory could not be created.");
    const product = Array.isArray(productData) ? productData[0] : productData;
    if (!product?.product_id) throw new Error("Demo product and inventory could not be created.");

    let uploadedImagePath: string | null = null;
    let uploadedImageUrl: string | null = null;
    let imageWarning = "";
    if (image) {
      try {
        const uploaded = await uploadProductImage({ storeId: context.storeId, productId: product.product_id, image });
        uploadedImagePath = uploaded.imagePath;
        uploadedImageUrl = uploaded.imageUrl;
        await updateProductImageReference({ storeId: context.storeId, productId: product.product_id, imagePath: uploaded.imagePath, imageUrl: uploaded.imageUrl });
      } catch {
        imageWarning = " The product was saved without its picture; retry the picture from Edit Product.";
      }
    }

    await auditDemoAction("admin_demo_created_product", "products", product.product_id, { productName: parsed.productName, category: parsed.category, subcategory: parsed.subcategory, packageCount: parsed.packageCount });
    revalidateDemoStorePaths();
    return {
      ok: true,
      message: `${parsed.initialStockQuantity > 0 ? "Demo product created and stock added successfully." : "Demo product created. Enter a quantity, then click Add Stock to update inventory."}${imageWarning}`,
      createdProduct: {
        id: product.product_id,
        product_name: parsed.productName,
        category: parsed.category,
        subcategory: parsed.subcategory,
        cultivation_type: cultivationType,
        description: null,
        thc_per_unit_mg: parsed.thcPerUnitMg ?? null,
        thc_per_packet_mg: parsed.thcPerPacketMg ?? null,
        price: parsed.price,
        product_status: parsed.productStatus,
        is_visible_on_pos: true,
        image_bucket: uploadedImagePath ? productImageBucket : null,
        image_path: uploadedImagePath,
        image_url: uploadedImageUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        inventory_stock: {
          current_quantity: parsed.initialStockQuantity,
          low_stock_threshold: parsed.lowStockThreshold,
          updated_at: new Date().toISOString()
        }
      } satisfies ManagerInventoryProduct
    };
  } catch (error) {
    return { ok: false, message: demoActionMessage(error, "Unable to save demo product.") };
  }
}

export async function updateAdminDemoProductCardAction(_prev: ManagerActionState, formData: FormData): Promise<ManagerActionState> {
  try {
    await verifyOrigin();
    const context = await requireAdminDemoStoreContext();
    await assertRateLimit(`admin:demo-product-update:${context.adminUserId}`, 40, 60 * 60_000);
    const admin = requireAdminDemoClient();
    const parsed = productEditSchema.parse({
      productId: text(formData, "productId"),
      category: text(formData, "category"),
      subcategory: text(formData, "subcategory"),
      cultivationType: text(formData, "cultivationType") || undefined,
      productName: text(formData, "productName"),
      packageCount: text(formData, "packageCount"),
      thcPerUnitMg: text(formData, "thcPerUnitMg"),
      thcPerPacketMg: text(formData, "thcPerPacketMg"),
      price: text(formData, "price"),
      productStatus: text(formData, "productStatus")
    }) as ProductEditInput;

    const expectedCultivationType = isCanonicalVapeSelection(parsed) ? parsed.cultivationType ?? null : categoryAllowsCultivationType(parsed.category) ? parsed.cultivationType ?? null : null;
    const { data: product, error: productError } = await admin
      .from("products")
      .select("id, store_id, category, subcategory, cultivation_type, facet_values, image_path")
      .eq("id", parsed.productId)
      .eq("store_id", context.storeId)
      .is("deleted_at", null)
      .maybeSingle();

    if (productError) throw new Error(productError.message);
    if (!product) throw new Error("Demo product does not exist in the Admin Demo Store.");
    if (product.category !== parsed.category) throw new Error("Demo product category cannot be changed from this screen.");
    const image = await validatedProductImage(formData);
    const shouldRemoveImage = removeImageRequested(formData);

    await ensureUniqueDemoProduct({
      storeId: context.storeId,
      productName: parsed.productName,
      category: parsed.category,
      subcategory: parsed.subcategory,
      cultivationType: expectedCultivationType,
      excludeProductId: parsed.productId
    });

    const existingFacetValues = product.facet_values && typeof product.facet_values === "object" && !Array.isArray(product.facet_values) ? product.facet_values as Record<string, unknown> : {};
    const facet_values: Record<string, unknown> = {
      ...existingFacetValues,
      managerCategory: parsed.category,
      managerSubcategory: parsed.subcategory,
      cultivationType: expectedCultivationType ?? ""
    };
    if (parsed.category === "Edibles") {
      facet_values.packageCount = parsed.packageCount;
    } else {
      delete facet_values.packageCount;
    }

    const productUpdate: Record<string, unknown> = {
      product_name: parsed.productName,
      name: parsed.productName,
      brand: parsed.productName,
      subcategory: parsed.subcategory,
      subcategory_slug: parsed.subcategory,
      cultivation_type: expectedCultivationType,
      strain_type: isCanonicalVapeSelection(parsed) ? expectedCultivationType : parsed.subcategory,
      grow_type: expectedCultivationType,
      price: parsed.price,
      price_cents: Math.round(parsed.price * 100),
      product_status: parsed.productStatus,
      is_published: parsed.productStatus === "active",
      facet_values,
      updated_at: new Date().toISOString(),
      ...edibleThcDatabaseFields(parsed)
    };

    const { error: updateError } = await admin
      .from("products")
      .update(productUpdate)
      .eq("id", parsed.productId)
      .eq("store_id", context.storeId)
      .is("deleted_at", null);
    if (updateError) throw new Error(updateError.message);

    let imageBucket: string | null | undefined;
    let imagePath: string | null | undefined;
    let imageUrl: string | null | undefined;
    if (image) {
      const uploaded = await uploadProductImage({ storeId: context.storeId, productId: parsed.productId, image });
      await updateProductImageReference({ storeId: context.storeId, productId: parsed.productId, imagePath: uploaded.imagePath, imageUrl: uploaded.imageUrl, oldImagePath: product.image_path });
      imageBucket = productImageBucket;
      imagePath = uploaded.imagePath;
      imageUrl = uploaded.imageUrl;
    } else if (shouldRemoveImage) {
      await clearProductImageReference({ storeId: context.storeId, productId: parsed.productId, oldImagePath: product.image_path });
      imageBucket = null;
      imagePath = null;
      imageUrl = null;
    }

    await auditDemoAction("admin_demo_updated_product_card", "products", parsed.productId, { productName: parsed.productName, category: parsed.category, subcategory: parsed.subcategory, cultivationType: expectedCultivationType, packageCount: parsed.packageCount, imageChanged: Boolean(image), imageRemoved: shouldRemoveImage });
    revalidateDemoStorePaths();
    return { ok: true, message: "Demo product changes saved.", imageBucket, imagePath, imageUrl };
  } catch (error) {
    return { ok: false, message: demoActionMessage(error, "Unable to update demo product card.") };
  }
}

export async function updateAdminDemoProductPosVisibilityAction(_prev: ManagerActionState, formData: FormData): Promise<ManagerActionState> {
  try {
    await verifyOrigin();
    const context = await requireAdminDemoStoreContext();
    await assertRateLimit(`admin:demo-pos-visibility:${context.adminUserId}`, 60, 60 * 60_000);
    const admin = requireAdminDemoClient();
    const parsed = visibilitySchema.parse({
      productId: text(formData, "productId"),
      isVisibleOnPos: text(formData, "isVisibleOnPos")
    });
    const nextVisible = parsed.isVisibleOnPos === "true";

    const { data: product, error: productError } = await admin
      .from("products")
      .select("id, store_id, product_name, product_status, is_visible_on_pos, deleted_at")
      .eq("id", parsed.productId)
      .eq("store_id", context.storeId)
      .is("deleted_at", null)
      .maybeSingle();

    if (productError) throw new Error(productError.message);
    if (!product) throw new Error("Demo product does not exist in the Admin Demo Store.");
    if (nextVisible && product.product_status !== "active") throw new Error("Only active demo products can be put back on the POS.");

    const previousVisible = product.is_visible_on_pos !== false;
    if (previousVisible === nextVisible) {
      return { ok: true, message: nextVisible ? "Demo product is already visible on POS." : "Demo product is already hidden from POS.", productId: parsed.productId, isVisibleOnPos: nextVisible };
    }

    const { error: updateError } = await admin
      .from("products")
      .update({ is_visible_on_pos: nextVisible, updated_at: new Date().toISOString() })
      .eq("id", parsed.productId)
      .eq("store_id", context.storeId)
      .is("deleted_at", null);
    if (updateError) throw new Error(updateError.message);

    await auditDemoAction(nextVisible ? "product_restored_to_pos" : "product_removed_from_pos", "products", parsed.productId, {
      productId: parsed.productId,
      productName: product.product_name,
      previousVisible,
      newVisible: nextVisible
    });
    revalidateDemoStorePaths();
    return { ok: true, message: nextVisible ? "Demo product put back on POS." : "Demo product removed from POS.", productId: parsed.productId, isVisibleOnPos: nextVisible };
  } catch (error) {
    return { ok: false, message: demoActionMessage(error, "Unable to update demo POS visibility.") };
  }
}

export async function archiveAdminDemoProductAction(_prev: ManagerActionState, formData: FormData): Promise<ManagerActionState> {
  try {
    await verifyOrigin();
    const context = await requireAdminDemoStoreContext();
    await assertRateLimit(`admin:demo-product-archive:${context.adminUserId}`, 40, 60 * 60_000);
    const admin = requireAdminDemoClient();
    const parsed = productArchiveSchema.parse({ productId: text(formData, "productId") });

    const { data: product, error: productError } = await admin
      .from("products")
      .select("id, store_id, product_name, product_status, is_visible_on_pos, deleted_at")
      .eq("id", parsed.productId)
      .eq("store_id", context.storeId)
      .is("deleted_at", null)
      .maybeSingle();

    if (productError) throw new Error(productError.message);
    if (!product) throw new Error("Demo product does not exist in the Admin Demo Store.");

    const archivedAt = new Date().toISOString();
    const previousStatus = product.product_status;
    const previousVisible = product.is_visible_on_pos !== false;
    const { error: updateError } = await admin
      .from("products")
      .update({ product_status: "inactive", is_visible_on_pos: false, deleted_at: archivedAt, updated_at: archivedAt })
      .eq("id", parsed.productId)
      .eq("store_id", context.storeId)
      .is("deleted_at", null);
    if (updateError) throw new Error(updateError.message);

    await auditDemoAction("manager_archived_product", "products", parsed.productId, {
      productId: parsed.productId,
      productName: product.product_name,
      previousStatus,
      previousVisible,
      newStatus: "inactive",
      newVisible: false
    });
    revalidateDemoStorePaths();
    return { ok: true, message: "Demo product deleted from inventory.", productId: parsed.productId };
  } catch (error) {
    return { ok: false, message: demoActionMessage(error, "Unable to delete demo product.") };
  }
}

export async function addAdminDemoInventoryStockAction(_prev: ManagerActionState, formData: FormData): Promise<ManagerActionState> {
  try {
    await verifyOrigin();
    const context = await requireAdminDemoStoreContext();
    await assertRateLimit(`admin:demo-inventory-add:${context.adminUserId}`, 60, 60 * 60_000);
    const admin = requireAdminDemoClient();
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const parsed = inventoryAddSchema.parse({
      category: text(formData, "category"),
      subcategory: text(formData, "subcategory"),
      cultivationType: text(formData, "cultivationType") || undefined,
      productId: text(formData, "productId"),
      quantityToAdd: text(formData, "quantityToAdd"),
      reason: "manual_adjustment"
    }) as InventoryAddInput;

    const { data: product, error: productError } = await admin
      .from("products")
      .select("id, store_id, category, subcategory, cultivation_type, image_path")
      .eq("id", parsed.productId)
      .eq("store_id", context.storeId)
      .single();
    if (productError || !product) throw new Error("Demo product does not exist in the Admin Demo Store.");
    if (!selectedProductMatchesFilters(product, parsed)) {
      throw new Error("Demo product does not match the selected filters.");
    }
    const image = await validatedProductImage(formData);
    const shouldRemoveImage = removeImageRequested(formData);
    const { data: stockData, error: stockError } = await supabase.rpc("add_admin_demo_inventory_stock", {
      p_store_id: context.storeId,
      p_product_id: parsed.productId,
      p_quantity: parsed.quantityToAdd,
      p_reason: parsed.reason ?? "manual_adjustment"
    });
    if (stockError) throw new Error("Demo inventory could not be updated.");
    const stock = Array.isArray(stockData) ? stockData[0] : stockData;
    if (!stock || !Number.isInteger(Number(stock.new_quantity))) {
      throw new Error("Demo inventory could not be updated.");
    }

    let imageWarning = "";
    try {
      if (image) {
        const uploaded = await uploadProductImage({ storeId: context.storeId, productId: parsed.productId, image });
        await updateProductImageReference({ storeId: context.storeId, productId: parsed.productId, imagePath: uploaded.imagePath, imageUrl: uploaded.imageUrl, oldImagePath: product.image_path });
      } else if (shouldRemoveImage) {
        await clearProductImageReference({ storeId: context.storeId, productId: parsed.productId, oldImagePath: product.image_path });
      }
    } catch {
      imageWarning = " Stock was added, but the product picture could not be updated.";
    }

    revalidateDemoStorePaths();
    return { ok: true, message: `Demo stock added successfully.${imageWarning}`, updatedStock: Number(stock.new_quantity) };
  } catch (error) {
    return { ok: false, message: demoActionMessage(error, "Unable to update demo inventory.") };
  }
}

const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().min(0)
});

const checkoutSchema = z.object({
  checkoutId: z.string().uuid(),
  items: z.array(checkoutItemSchema).min(1, "Cart is empty.")
});

export async function checkoutAdminDemoSaleAction(input: CheckoutInput): Promise<CheckoutResult> {
  try {
    await verifyOrigin();
    const context = await requireAdminDemoStoreContext();
    await assertRateLimit(`admin:demo-checkout:${context.adminUserId}`, 20, 60_000);
    const parsed = checkoutSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.rpc("complete_admin_demo_sale", {
      p_store_id: context.storeId,
      p_checkout_id: parsed.checkoutId,
      p_items: parsed.items
    });
    if (error) throw new Error("Demo checkout could not be completed. Review the cart and try again.");
    const sale = Array.isArray(data) ? data[0] : data;
    if (!sale?.sale_id) throw new Error("Demo checkout could not be completed.");

    revalidateDemoStorePaths();
    return {
      ok: true,
      message: sale.already_completed ? "Demo sale was already completed." : "Demo sale completed and demo stock was reduced.",
      saleId: sale.sale_id
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, message: error.issues[0]?.message ?? "Invalid demo cart." };
    }
    return { ok: false, message: "Demo checkout failed. Please review the cart and try again." };
  }
}
