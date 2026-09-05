"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { ManagerActionState } from "@/app/dashboard/manager/actions";
import { invalidateStoreDisplayCache } from "@/lib/cache/redis";
import { requireActiveManager, requireAdminClient } from "@/lib/manager/auth";
import type { ManagerInventoryProduct } from "@/lib/manager/data";
import { categoryAllowsCultivationType, categoryAllowsProductImageOnCreate, VAPE_PRODUCT_TYPES } from "@/lib/manager/options";
import { productFormSchema, type ProductFormInput } from "@/lib/manager/validation";
import { maxProductImageBytes, normalizeProductImage, productImageObjectPath } from "@/lib/product-image-upload";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { requireAssignedStoreId } from "@/lib/store-scope";

const productImageBucket = "product-images";
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const missingProductDatabaseMessage = "Product database tables are not set up yet. Please apply Supabase migrations.";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
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

function productImageCandidate(formData: FormData, category: string) {
  if (!categoryAllowsProductImageOnCreate(category)) return null;
  const image = formData.get("productImage");
  if (!(image instanceof File) || image.size === 0) return null;
  if (image.size > maxProductImageBytes) throw new Error("Product image must be 6MB or smaller.");
  if (!allowedImageTypes.has(image.type.toLowerCase())) {
    throw new Error("Product image must be a valid JPEG, PNG, or WebP file.");
  }
  return image;
}

async function finishProductImage(input: { storeId: string; productId: string; image: File }) {
  const admin = requireAdminClient();
  const normalized = await normalizeProductImage(input.image);
  const imagePath = productImageObjectPath(input.storeId, input.productId);
  const { error: uploadError } = await admin.storage.from(productImageBucket).upload(imagePath, normalized.data, {
    upsert: false,
    contentType: normalized.contentType,
    cacheControl: "31536000"
  });
  if (uploadError) throw new Error("Product image could not be uploaded.");

  const { data: publicUrl } = admin.storage.from(productImageBucket).getPublicUrl(imagePath);
  const imageUrl = publicUrl.publicUrl;
  const { error: updateError } = await admin
    .from("products")
    .update({ image_bucket: productImageBucket, image_path: imagePath, image_url: imageUrl })
    .eq("id", input.productId)
    .eq("store_id", input.storeId)
    .is("deleted_at", null);

  if (updateError) {
    await admin.storage.from(productImageBucket).remove([imagePath]);
    throw new Error("Product image could not be saved.");
  }
}

function createdProduct(input: {
  productId: string;
  parsed: ProductFormInput;
  cultivationType: string | null;
}): ManagerInventoryProduct {
  const now = new Date().toISOString();
  return {
    id: input.productId,
    product_name: input.parsed.productName,
    brand: input.parsed.productName,
    category: input.parsed.category,
    subcategory: input.parsed.subcategory,
    cultivation_type: input.cultivationType,
    description: null,
    thc_per_unit_mg: input.parsed.thcPerUnitMg ?? null,
    thc_per_packet_mg: input.parsed.thcPerPacketMg ?? null,
    price: input.parsed.price,
    product_status: input.parsed.productStatus,
    is_visible_on_pos: true,
    image_bucket: null,
    image_path: null,
    image_url: null,
    created_at: now,
    updated_at: now,
    inventory_stock: {
      current_quantity: input.parsed.initialStockQuantity,
      low_stock_threshold: input.parsed.lowStockThreshold,
      updated_at: now
    }
  };
}

export async function createProductFastAction(_prev: ManagerActionState, formData: FormData): Promise<ManagerActionState> {
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

    const image = productImageCandidate(formData, parsed.category);
    const parsedCultivationType = typeof parsed.cultivationType === "string" ? parsed.cultivationType : undefined;
    const cultivationType = isCanonicalVapeSelection(parsed)
      ? parsedCultivationType ?? null
      : categoryAllowsCultivationType(parsed.category)
        ? parsedCultivationType ?? null
        : null;
    const storeId = requireAssignedStoreId(managerProfile, "Manager");

    // The RPC already performs the authoritative duplicate check, creates the
    // product and inventory atomically, and records the product-creation audit.
    // Avoiding the old pre-query and second audit insert removes two network
    // round trips from the manager's critical save path.
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
    const productId = String(product.product_id);

    // Image normalization/upload and Redis invalidation are important, but they
    // do not need to keep the Save Product button spinning. Next.js `after`
    // uses Vercel waitUntil so this work can finish after the action response.
    after(async () => {
      if (image) {
        try {
          await finishProductImage({ storeId, productId, image });
        } catch (error) {
          console.error("Deferred product image processing failed", {
            productId,
            storeId,
            error: error instanceof Error ? error.message : "unknown_error"
          });
        }
      }
      await invalidateStoreDisplayCache(storeId);
    });

    revalidatePath("/dashboard/manager/products");
    revalidatePath("/dashboard/manager/inventory/manage");
    revalidatePath("/dashboard/manager/inventory");

    const baseMessage = parsed.initialStockQuantity > 0
      ? "Product created and stock added successfully."
      : "Product created. Enter a quantity, then click Add Stock to update inventory.";

    return {
      ok: true,
      message: image ? `${baseMessage} Picture processing will finish in the background.` : baseMessage,
      createdProduct: createdProduct({ productId, parsed, cultivationType })
    };
  } catch (error) {
    return { ok: false, message: managerActionMessage(error, "Unable to save product.") };
  }
}
