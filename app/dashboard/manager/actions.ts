"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { invalidateManagerStaffCache, invalidateStoreDisplayCache } from "@/lib/cache/redis";
import { requireActiveManager, requireAdminClient } from "@/lib/manager/auth";
import { edibleThcDatabaseFields, type ManagerInventoryProduct } from "@/lib/manager/data";
import { categoryAllowsCultivationType, categoryAllowsProductImageOnCreate, VAPE_PRODUCT_TYPES, VAPE_STRAIN_TYPES } from "@/lib/manager/options";
import { inventoryAddSchema, productEditSchema, productFormSchema, staffActionSchema, staffCreateSchema, staffResetPasswordSchema, type InventoryAddInput, type ProductEditInput, type ProductFormInput } from "@/lib/manager/validation";
import { normalizeProductImage, productImageObjectPath, type NormalizedProductImage } from "@/lib/product-image-upload";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { requireAssignedStoreId } from "@/lib/store-scope";
import { sendStaffPasswordResetLink } from "@/lib/staff-password-reset";

export type ManagerActionState = { ok: boolean; message: string; createdProduct?: ManagerInventoryProduct; updatedStock?: number; productId?: string; isVisibleOnPos?: boolean; imageBucket?: string | null; imagePath?: string | null; imageUrl?: string | null };

const productImageBucket = "product-images";
const missingProductDatabaseMessage = "Product database tables are not set up yet. Please apply Supabase migrations.";
const missingStaffDatabaseMessage = "Receptionist account database functions are not set up yet. Please apply Supabase migrations.";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function audit(action: string, tableName: string, recordId: string | null, details: Record<string, unknown>) {
  const { user, profile } = await requireActiveManager();
  const admin = requireAdminClient();
  const storeId = requireAssignedStoreId(profile, "Manager");
  const result = typeof details.result === "string" ? details.result : "success";
  await admin.from("audit_logs").insert({
    user_id: user.id,
    action,
    table_name: tableName,
    record_id: recordId,
    store_id: storeId,
    result,
    details
  });
}

async function ensureUniqueProduct(input: { storeId: string; productName: string; category: string; subcategory: string; cultivationType: string | null; excludeProductId?: string }) {
  const admin = requireAdminClient();
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
  if (data) throw new Error("A matching product already exists in this store.");
}

const visibilitySchema = z.object({
  productId: z.string().uuid("Product is required"),
  isVisibleOnPos: z.enum(["true", "false"])
});

const productArchiveSchema = z.object({
  productId: z.string().uuid("Product is required")
});

async function validatedProductImage(formData: FormData) {
  const image = formData.get("productImage");
  if (!(image instanceof File) || image.size === 0) return null;
  return normalizeProductImage(image);
}

function removeImageRequested(formData: FormData) {
  return text(formData, "removeProductImage") === "1";
}

async function uploadProductImage(input: { storeId: string; productId: string; image: NormalizedProductImage }) {
  const admin = requireAdminClient();
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
  const admin = requireAdminClient();
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
  if (input.oldImagePath && input.oldImagePath !== input.imagePath) {
    await admin.storage.from(productImageBucket).remove([input.oldImagePath]);
  }
}

async function clearProductImageReference(input: { storeId: string; productId: string; oldImagePath?: string | null }) {
  const admin = requireAdminClient();
  const { error } = await admin
    .from("products")
    .update({ image_bucket: null, image_path: null, image_url: null })
    .eq("id", input.productId)
    .eq("store_id", input.storeId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  if (input.oldImagePath) await admin.storage.from(productImageBucket).remove([input.oldImagePath]);
}

function managerActionMessage(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  if (!(error instanceof Error)) return fallback;
  const lower = error.message.toLowerCase();
  if (lower.includes("schema cache") || lower.includes("could not find the table") || lower.includes("does not exist")) {
    return missingProductDatabaseMessage;
  }
  return error.message;
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

function staffAccountActionMessage(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Enter valid receptionist account details.";
  if (!(error instanceof Error)) return "Unable to create the receptionist account.";
  const lower = error.message.toLowerCase();
  if (lower.includes("schema cache") || lower.includes("could not find the table") || lower.includes("does not exist")) {
    return missingStaffDatabaseMessage;
  }
  if (lower.includes("receptionist_slot_limit_reached")) return "This store has reached its receptionist limit (5 / 5).";
  if (lower.includes("already registered") || lower.includes("already exists") || lower.includes("duplicate") || lower.includes("unique")) {
    return "That email is already attached to a GreenChoice or Supabase Auth account.";
  }
  return error.message;
}

async function verifyManagerPassword(password: string) {
  const { supabase, user } = await requireActiveManager();
  const email = user.email?.toLowerCase();
  if (!email) throw new Error("Manager email could not be verified.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || data.user?.id !== user.id) {
    await audit("manager_reauthentication_failed", "staff_profiles", null, {});
    throw new Error("Manager password verification failed.");
  }
}

async function authUserByEmail(email: string) {
  const admin = requireAdminClient();
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("Supabase Auth users could not be checked.");
    const match = data.users.find((candidate) => candidate.email?.trim().toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

async function deleteUnboundManagerCreatedReceptionist(authUserId: string) {
  try {
    const admin = requireAdminClient();
    const [{ data: authData }, profileResult] = await Promise.all([
      admin.auth.admin.getUserById(authUserId),
      admin.from("staff_profiles").select("id").eq("auth_user_id", authUserId).maybeSingle()
    ]);
    const user = authData.user;
    if (!profileResult.error && !profileResult.data &&
        user?.app_metadata?.greenchoice_role === "receptionist" &&
        user.app_metadata?.greenchoice_registration === "manager_created") {
      await admin.auth.admin.deleteUser(authUserId);
    }
  } catch {
    // Cleanup must not hide the original profile-creation failure.
  }
}

export async function createProductAction(_prev: ManagerActionState, formData: FormData): Promise<ManagerActionState> {
  try {
    await verifyOrigin();
    const { supabase, user, profile: managerProfile } = await requireActiveManager();
    await assertRateLimit(`manager:product-create:${user.id}`, 20, 60 * 60_000);
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
    const storeId = requireAssignedStoreId(managerProfile, "Manager");

    await ensureUniqueProduct({
      storeId,
      productName: parsed.productName,
      category: parsed.category,
      subcategory: parsed.subcategory,
      cultivationType
    });

    const { data: productData, error: productError } = await supabase.rpc("create_product_with_inventory", {
      p_store_id: storeId,
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
    if (productError) {
      if (productError.message.toLowerCase().includes("duplicate_product")) {
        throw new Error("A matching product already exists in this store.");
      }
      throw new Error("Product and inventory could not be created.");
    }
    const product = Array.isArray(productData) ? productData[0] : productData;
    if (!product?.product_id) throw new Error("Product and inventory could not be created.");

    let uploadedImagePath: string | null = null;
    let uploadedImageUrl: string | null = null;
    let imageWarning = "";
    if (image) {
      try {
        const uploaded = await uploadProductImage({ storeId, productId: product.product_id, image });
        uploadedImagePath = uploaded.imagePath;
        uploadedImageUrl = uploaded.imageUrl;
        await updateProductImageReference({ storeId, productId: product.product_id, imagePath: uploaded.imagePath, imageUrl: uploaded.imageUrl });
      } catch {
        imageWarning = " The product was saved without its picture; retry the picture from Edit Product.";
      }
    }

    await audit("manager_created_product", "products", product.product_id, { productName: parsed.productName, category: parsed.category, subcategory: parsed.subcategory, packageCount: parsed.packageCount, storeId });
    await invalidateStoreDisplayCache(storeId);
    revalidatePath("/dashboard/manager/products");
    revalidatePath("/dashboard/manager/inventory/manage");
    revalidatePath("/dashboard/manager/inventory");
    return {
      ok: true,
      message: `${parsed.initialStockQuantity > 0 ? "Product created and stock added successfully." : "Product created. Enter a quantity, then click Add Stock to update inventory."}${imageWarning}`,
      createdProduct: {
        id: product.product_id,
        product_name: parsed.productName,
        brand: parsed.productName,
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
      }
    };
  } catch (error) {
    return { ok: false, message: managerActionMessage(error, "Unable to save product.") };
  }
}

export async function updateProductCardAction(_prev: ManagerActionState, formData: FormData): Promise<ManagerActionState> {
  try {
    await verifyOrigin();
    const { user, profile: managerProfile } = await requireActiveManager();
    await assertRateLimit(`manager:product-update:${user.id}`, 40, 60 * 60_000);
    const storeId = requireAssignedStoreId(managerProfile, "Manager");
    const admin = requireAdminClient();
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
      .eq("store_id", storeId)
      .is("deleted_at", null)
      .maybeSingle();

    if (productError) throw new Error(productError.message);
    if (!product) throw new Error("Product does not exist in your store.");
    if (product.category !== parsed.category) throw new Error("Product category cannot be changed from this screen.");
    const image = await validatedProductImage(formData);
    const shouldRemoveImage = removeImageRequested(formData);

    await ensureUniqueProduct({
      storeId,
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
      .eq("store_id", storeId)
      .is("deleted_at", null);
    if (updateError) throw new Error(updateError.message);

    let imageBucket: string | null | undefined;
    let imagePath: string | null | undefined;
    let imageUrl: string | null | undefined;
    if (image) {
      const uploaded = await uploadProductImage({ storeId, productId: parsed.productId, image });
      await updateProductImageReference({ storeId, productId: parsed.productId, imagePath: uploaded.imagePath, imageUrl: uploaded.imageUrl, oldImagePath: product.image_path });
      imageBucket = productImageBucket;
      imagePath = uploaded.imagePath;
      imageUrl = uploaded.imageUrl;
    } else if (shouldRemoveImage) {
      await clearProductImageReference({ storeId, productId: parsed.productId, oldImagePath: product.image_path });
      imageBucket = null;
      imagePath = null;
      imageUrl = null;
    }

    await audit("manager_updated_product_card", "products", parsed.productId, { productName: parsed.productName, category: parsed.category, subcategory: parsed.subcategory, cultivationType: expectedCultivationType, packageCount: parsed.packageCount, storeId, imageChanged: Boolean(image), imageRemoved: shouldRemoveImage });
    await invalidateStoreDisplayCache(storeId);
    revalidatePath("/dashboard/manager/products");
    revalidatePath("/dashboard/manager/products/edit");
    revalidatePath("/dashboard/manager/inventory");
    revalidatePath("/dashboard/manager/inventory/view");
    return { ok: true, message: "Product changes saved.", imageBucket, imagePath, imageUrl };
  } catch (error) {
    return { ok: false, message: managerActionMessage(error, "Unable to update product card.") };
  }
}

export async function updateProductPosVisibilityAction(_prev: ManagerActionState, formData: FormData): Promise<ManagerActionState> {
  try {
    await verifyOrigin();
    const { profile: managerProfile } = await requireActiveManager();
    const storeId = requireAssignedStoreId(managerProfile, "Manager");
    const admin = requireAdminClient();
    const parsed = visibilitySchema.parse({
      productId: text(formData, "productId"),
      isVisibleOnPos: text(formData, "isVisibleOnPos")
    });
    const nextVisible = parsed.isVisibleOnPos === "true";

    const { data: product, error: productError } = await admin
      .from("products")
      .select("id, store_id, product_name, product_status, is_visible_on_pos, deleted_at")
      .eq("id", parsed.productId)
      .eq("store_id", storeId)
      .is("deleted_at", null)
      .maybeSingle();

    if (productError) throw new Error(productError.message);
    if (!product) throw new Error("Product does not exist in your store.");
    if (nextVisible && product.product_status !== "active") throw new Error("Only active products can be put back on the POS.");

    const previousVisible = product.is_visible_on_pos !== false;
    if (previousVisible === nextVisible) {
      return { ok: true, message: nextVisible ? "Product is already visible on POS." : "Product is already hidden from POS.", productId: parsed.productId, isVisibleOnPos: nextVisible };
    }

    const { error: updateError } = await admin
      .from("products")
      .update({ is_visible_on_pos: nextVisible, updated_at: new Date().toISOString() })
      .eq("id", parsed.productId)
      .eq("store_id", storeId)
      .is("deleted_at", null);
    if (updateError) throw new Error(updateError.message);

    await audit(nextVisible ? "product_restored_to_pos" : "product_removed_from_pos", "products", parsed.productId, {
      productId: parsed.productId,
      productName: product.product_name,
      storeId,
      previousVisible,
      newVisible: nextVisible
    });
    await invalidateStoreDisplayCache(storeId);
    revalidatePath("/dashboard/manager/inventory");
    revalidatePath("/dashboard/receptionist/products");
    return { ok: true, message: nextVisible ? "Product put back on POS." : "Product removed from POS.", productId: parsed.productId, isVisibleOnPos: nextVisible };
  } catch (error) {
    return { ok: false, message: managerActionMessage(error, "Unable to update POS visibility.") };
  }
}

export async function archiveProductAction(_prev: ManagerActionState, formData: FormData): Promise<ManagerActionState> {
  try {
    await verifyOrigin();
    const { profile: managerProfile } = await requireActiveManager();
    const storeId = requireAssignedStoreId(managerProfile, "Manager");
    const admin = requireAdminClient();
    const parsed = productArchiveSchema.parse({ productId: text(formData, "productId") });

    const { data: product, error: productError } = await admin
      .from("products")
      .select("id, store_id, product_name, product_status, is_visible_on_pos, deleted_at")
      .eq("id", parsed.productId)
      .eq("store_id", storeId)
      .is("deleted_at", null)
      .maybeSingle();

    if (productError) throw new Error(productError.message);
    if (!product) throw new Error("Product does not exist in your store.");

    const archivedAt = new Date().toISOString();
    const previousStatus = product.product_status;
    const previousVisible = product.is_visible_on_pos !== false;
    const { error: updateError } = await admin
      .from("products")
      .update({ product_status: "inactive", is_visible_on_pos: false, deleted_at: archivedAt, updated_at: archivedAt })
      .eq("id", parsed.productId)
      .eq("store_id", storeId)
      .is("deleted_at", null);
    if (updateError) throw new Error(updateError.message);

    await audit("manager_archived_product", "products", parsed.productId, {
      productId: parsed.productId,
      productName: product.product_name,
      storeId,
      previousStatus,
      previousVisible,
      newStatus: "inactive",
      newVisible: false
    });
    await invalidateStoreDisplayCache(storeId);
    revalidatePath("/dashboard/manager/inventory");
    revalidatePath("/dashboard/receptionist/products");
    return { ok: true, message: "Product deleted from inventory.", productId: parsed.productId };
  } catch (error) {
    return { ok: false, message: managerActionMessage(error, "Unable to delete product.") };
  }
}

export async function addInventoryStockAction(_prev: ManagerActionState, formData: FormData): Promise<ManagerActionState> {
  try {
    await verifyOrigin();
    const { supabase, user, profile: managerProfile } = await requireActiveManager();
    await assertRateLimit(`manager:inventory-add:${user.id}`, 60, 60 * 60_000);
    const storeId = requireAssignedStoreId(managerProfile, "Manager");
    const admin = requireAdminClient();
    const parsed = inventoryAddSchema.parse({
      category: text(formData, "category"),
      subcategory: text(formData, "subcategory"),
      cultivationType: text(formData, "cultivationType") || undefined,
      productId: text(formData, "productId"),
      quantityToAdd: text(formData, "quantityToAdd"),
      reason: "manual_adjustment"
    }) as InventoryAddInput;

    const { data: product, error: productError } = await admin.from("products").select("id, store_id, category, subcategory, cultivation_type, image_path").eq("id", parsed.productId).eq("store_id", storeId).single();
    if (productError || !product) throw new Error("Product does not exist in Supabase.");
    if (!selectedProductMatchesFilters(product, parsed)) {
      throw new Error("Product does not match the selected filters.");
    }
    const image = await validatedProductImage(formData);
    const shouldRemoveImage = removeImageRequested(formData);
    if (image) {
      const uploaded = await uploadProductImage({ storeId, productId: parsed.productId, image });
      await updateProductImageReference({ storeId, productId: parsed.productId, imagePath: uploaded.imagePath, imageUrl: uploaded.imageUrl, oldImagePath: product.image_path });
    } else if (shouldRemoveImage) {
      await clearProductImageReference({ storeId, productId: parsed.productId, oldImagePath: product.image_path });
    }

    const { data: stockData, error: stockError } = await supabase.rpc("add_inventory_stock_atomic", {
      p_product_id: parsed.productId,
      p_quantity: parsed.quantityToAdd,
      p_reason: parsed.reason ?? "manual_adjustment"
    });
    if (stockError) throw new Error("Inventory could not be updated.");
    const stockResult = Array.isArray(stockData) ? stockData[0] : stockData;
    const newQuantity = Number(stockResult?.new_quantity);
    if (!Number.isInteger(newQuantity)) throw new Error("Inventory could not be updated.");
    await invalidateStoreDisplayCache(storeId);
    revalidatePath("/dashboard/manager/inventory");
    revalidatePath("/dashboard/manager/inventory/manage");
    return { ok: true, message: "Stock added successfully.", updatedStock: newQuantity };
  } catch (error) {
    return { ok: false, message: managerActionMessage(error, "Unable to update inventory.") };
  }
}

export async function createStaffAccountAction(_prev: ManagerActionState, formData: FormData): Promise<ManagerActionState> {
  let createdAuthUserId: string | null = null;
  try {
    await verifyOrigin();
    const { supabase, user, profile: managerProfile } = await requireActiveManager();
    await assertRateLimit(`manager:staff-direct-create:${user.id}`, 10, 60 * 60_000);
    const storeId = requireAssignedStoreId(managerProfile, "Manager");
    const parsed = staffCreateSchema.parse({
      email: text(formData, "email"),
      password: text(formData, "password"),
      confirmPassword: text(formData, "confirmPassword")
    });
    if (parsed.email === user.email?.trim().toLowerCase()) throw new Error("You cannot create a receptionist account with your manager email address.");

    const admin = requireAdminClient();
    const { data: existingStaff, error: staffReadError } = await admin
      .from("staff_profiles")
      .select("id")
      .ilike("email", parsed.email)
      .maybeSingle();
    if (staffReadError) throw new Error("Existing GreenChoice accounts could not be checked.");
    if (existingStaff || await authUserByEmail(parsed.email)) {
      throw new Error("That email is already attached to a GreenChoice or Supabase Auth account.");
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: parsed.email,
      password: parsed.password,
      email_confirm: true,
      app_metadata: {
        greenchoice_role: "receptionist",
        greenchoice_registration: "manager_created",
        greenchoice_store_id: storeId,
        greenchoice_manager_id: user.id
      }
    });
    if (authError || !authData.user?.id) throw new Error(authError?.message ?? "Supabase Auth did not create the receptionist account.");
    createdAuthUserId = authData.user.id;

    const { data: profileData, error: profileError } = await supabase.rpc("create_manager_receptionist_profile", {
      p_auth_user_id: createdAuthUserId,
      p_email: parsed.email
    });
    if (profileError) throw new Error(profileError.message);
    const profileResult = Array.isArray(profileData) ? profileData[0] : profileData;
    if (!profileResult?.profile_id) throw new Error("The receptionist profile was not created.");

    await invalidateManagerStaffCache(storeId);
    revalidatePath("/dashboard/manager/staff");
    return { ok: true, message: "Account created. Give the receptionist their email and temporary password securely; they must replace it at first login." };
  } catch (error) {
    if (createdAuthUserId) await deleteUnboundManagerCreatedReceptionist(createdAuthUserId);
    return { ok: false, message: staffAccountActionMessage(error) };
  }
}

export async function updateStaffStatusAction(_prev: ManagerActionState, formData: FormData): Promise<ManagerActionState> {
  try {
    await verifyOrigin();
    const { supabase, user, profile: managerProfile } = await requireActiveManager();
    await assertRateLimit(`manager:staff-status:${user.id}`, 30, 60 * 60_000);
    const storeId = requireAssignedStoreId(managerProfile, "Manager");
    const admin = requireAdminClient();
    const parsed = staffActionSchema.parse({
      staffProfileId: text(formData, "staffProfileId"),
      action: text(formData, "action"),
      managerPassword: text(formData, "managerPassword"),
      confirmDeactivation: text(formData, "confirmDeactivation")
    });
    if (parsed.action === "deactivate" && parsed.confirmDeactivation !== "DEACTIVATE") {
      throw new Error("Type DEACTIVATE to confirm account deactivation.");
    }
    await verifyManagerPassword(parsed.managerPassword);

    const { data: target, error: targetError } = await admin
      .from("staff_profiles")
      .select("id, email, role, store_id, account_status, is_active")
      .eq("id", parsed.staffProfileId)
      .eq("store_id", storeId)
      .eq("role", "receptionist")
      .neq("account_status", "deleted")
      .single();
    if (targetError || !target) throw new Error("Receptionist account not found in your store.");

    const currentStatus = target.account_status ?? (target.is_active ? "active" : "deactivated");
    const accountStatus = parsed.action === "grant" ? "active" : parsed.action === "restrict" ? "restricted" : "deactivated";
    if (currentStatus === accountStatus) {
      return { ok: false, message: `This receptionist account is already ${accountStatus}.` };
    }

    const { data: statusResult, error } = await supabase.rpc("update_receptionist_account_status", {
      p_staff_profile_id: parsed.staffProfileId,
      p_account_status: accountStatus
    });
    const statusDecision = Array.isArray(statusResult) ? statusResult[0] : statusResult;
    if (statusDecision?.denial_reason === "receptionist_slot_limit_reached") {
      throw new Error("This store has reached its receptionist limit (5 / 5). Deactivate a receptionist or revoke an invitation first.");
    }
    if (error) throw new Error("Receptionist account status could not be updated.");
    await invalidateManagerStaffCache(storeId);
    revalidatePath("/dashboard/manager/staff");
    return { ok: true, message: "Receptionist account status updated." };
  } catch (error) {
    return { ok: false, message: managerActionMessage(error, "Unable to update staff access.") };
  }
}

export async function resetStaffPasswordAction(_prev: ManagerActionState, formData: FormData): Promise<ManagerActionState> {
  try {
    await verifyOrigin();
    const { user, profile: managerProfile } = await requireActiveManager();
    await assertRateLimit(`manager:staff-password-reset:${user.id}`, 3, 60 * 60_000);
    const storeId = requireAssignedStoreId(managerProfile, "Manager");
    const admin = requireAdminClient();
    const parsed = staffResetPasswordSchema.parse({
      staffProfileId: text(formData, "staffProfileId")
    });
    const { data: profile, error: profileError } = await admin
      .from("staff_profiles")
      .select("email")
      .eq("id", parsed.staffProfileId)
      .eq("store_id", storeId)
      .eq("role", "receptionist")
      .single();
    if (profileError || !profile) throw new Error("Staff profile not found.");
    await sendStaffPasswordResetLink(profile.email);
    await audit("manager_reset_staff_password", "staff_profiles", parsed.staffProfileId, {});
    return { ok: true, message: "If the account can receive email, Supabase has sent a secure password-reset link." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to reset password." };
  }
}

export async function redirectToReceptionistDashboardAction() {
  redirect("/dashboard/receptionist");
}
