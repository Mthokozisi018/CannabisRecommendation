"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveManager, requireAdminClient } from "@/lib/manager/auth";
import { supplierFormSchema } from "@/lib/manager/supplier-validation";
import { normalizeSupplierImage, supplierImageObjectPath } from "@/lib/product-image-upload";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { requireAssignedStoreId } from "@/lib/store-scope";
import { getManagerSupplyReport } from "@/lib/manager/supply-report";
import { listManagerSupplierData } from "@/lib/manager/suppliers";

export async function refreshManagerSupplyReport(input: unknown) {
  try {
    await verifyOrigin();
    const { user } = await requireActiveManager();
    await assertRateLimit(`manager:supply-report:${user.id}`, 60, 60_000);
    return { ok: true as const, report: await getManagerSupplyReport(input) };
  } catch { return { ok: false as const, message: "Supply history could not be loaded. Check the filters and retry." }; }
}

export async function loadManagerSupplierProfile(supplierId: string) {
  try {
    await verifyOrigin();
    const id = z.string().uuid().parse(supplierId);
    const { user } = await requireActiveManager();
    await assertRateLimit(`manager:supplier-profile:${user.id}`, 40, 60_000);
    const data = await listManagerSupplierData(id);
    const supplier = data.suppliers.find(supplier => supplier.id === id);
    if (!supplier) throw new Error("Supplier unavailable");
    return { ok: true as const, supplier, history: data.history };
  } catch { return { ok: false as const, message: "The supplier profile could not be loaded. Please retry." }; }
}

export type SupplierActionState = { ok: boolean; message: string; supplierId?: string };
const supplierLogoBucket = "product-images";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function refreshSupplierViews() {
  revalidatePath("/dashboard/manager/suppliers");
  revalidatePath("/dashboard/manager/inventory/manage");
}

export async function saveSupplierAction(_previous: SupplierActionState, formData: FormData): Promise<SupplierActionState> {
  let uploadedPath: string | null = null;
  try {
    await verifyOrigin();
    const { supabase, user, profile } = await requireActiveManager();
    const storeId = requireAssignedStoreId(profile, "Manager");
    await assertRateLimit(`manager:supplier-save:${user.id}`, 30, 60 * 60_000);
    let categories: unknown = [];
    try { categories = JSON.parse(text(formData, "categories")); }
    catch { throw new Error("Select at least one valid category and subcategory."); }
    const parsed = supplierFormSchema.parse({
      supplierId: text(formData, "supplierId") || undefined,
      name: text(formData, "name"), contactPerson: text(formData, "contactPerson"), phone: text(formData, "phone"),
      email: text(formData, "email"), address: text(formData, "address"),
      streetAddress: text(formData, "streetAddress"), suburb: text(formData, "suburb"), city: text(formData, "city"),
      postalCode: text(formData, "postalCode"), status: text(formData, "status"), categories
    });
    const admin = requireAdminClient();
    let existingNotes = "";
    if (parsed.supplierId) {
      const { data: existing, error: lookupError } = await admin.from("suppliers").select("notes").eq("id", parsed.supplierId).eq("store_id", storeId).single();
      if (lookupError || !existing) throw new Error("Supplier could not be found.");
      existingNotes = existing.notes ?? "";
    }
    const { data, error } = await supabase.rpc("save_supplier_atomic", {
      p_supplier_id: parsed.supplierId ?? null, p_name: parsed.name, p_contact_person: parsed.contactPerson,
      p_phone: parsed.phone, p_email: parsed.email, p_address: parsed.address, p_notes: existingNotes,
      p_status: parsed.status, p_categories: parsed.categories
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("duplicate_supplier")) throw new Error("This supplier already exists for your store.");
      if (message.includes("invalid_supplier_category")) throw new Error("One or more category selections are invalid.");
      throw new Error("Supplier information could not be saved.");
    }
    const result = Array.isArray(data) ? data[0] : data;
    const supplierId = String(result?.supplier_id ?? parsed.supplierId ?? "");
    if (!supplierId) throw new Error("Supplier information could not be saved.");
    const logo = formData.get("logo");
    let logoUpdate: Record<string, string | null> = {};
    if (logo instanceof File && logo.size > 0) {
      const image = await normalizeSupplierImage(logo);
      uploadedPath = supplierImageObjectPath(storeId, supplierId);
      const { error: uploadError } = await admin.storage.from(supplierLogoBucket).upload(uploadedPath, image.data, { contentType: image.contentType, upsert: false });
      if (uploadError) throw new Error("Supplier logo could not be uploaded.");
      const { data: urlData } = admin.storage.from(supplierLogoBucket).getPublicUrl(uploadedPath);
      logoUpdate = { logo_bucket: supplierLogoBucket, logo_path: uploadedPath, logo_url: urlData.publicUrl };
    }
    const address = [parsed.streetAddress, parsed.suburb, parsed.city, parsed.postalCode].filter(Boolean).join(", ") || parsed.address;
    const { data: current, error: updateError } = await admin.from("suppliers").update({
      street_address: parsed.streetAddress || null, suburb: parsed.suburb || null,
      city: parsed.city || null, postal_code: parsed.postalCode || null, address: address || null,
      ...logoUpdate
    }).eq("id", supplierId).eq("store_id", storeId).select("logo_path").single();
    if (updateError) throw new Error("Supplier profile details could not be saved.");
    const previousLogoPath = text(formData, "existingLogoPath");
    if (uploadedPath && previousLogoPath && previousLogoPath !== current.logo_path) {
      await admin.storage.from(supplierLogoBucket).remove([previousLogoPath]);
    }
    refreshSupplierViews();
    return { ok: true, message: parsed.supplierId ? "Supplier updated successfully." : "Supplier registered successfully.", supplierId };
  } catch (error) {
    if (uploadedPath) await requireAdminClient().storage.from(supplierLogoBucket).remove([uploadedPath]);
    if (error instanceof z.ZodError) return { ok: false, message: error.issues[0]?.message ?? "Enter valid supplier information." };
    return { ok: false, message: error instanceof Error ? error.message : "Supplier information could not be saved." };
  }
}

export async function archiveSupplierAction(supplierId: string): Promise<SupplierActionState> {
  try {
    await verifyOrigin();
    const { supabase, user, profile } = await requireActiveManager();
    const storeId = requireAssignedStoreId(profile, "Manager");
    await assertRateLimit(`manager:supplier-archive:${user.id}`, 15, 60 * 60_000);
    const admin = requireAdminClient();
    const { data: supplier, error: lookupError } = await admin.from("suppliers").select("name, contact_person, phone, email, address, notes").eq("id", supplierId).eq("store_id", storeId).single();
    if (lookupError || !supplier) throw new Error("Supplier could not be found.");
    const { data: mappings, error: mappingError } = await admin.from("supplier_categories").select("category, subcategory").eq("supplier_id", supplierId).eq("store_id", storeId);
    if (mappingError) throw new Error("Supplier relationships could not be checked.");
    const { error } = await supabase.rpc("save_supplier_atomic", {
      p_supplier_id: supplierId, p_name: supplier.name, p_contact_person: supplier.contact_person ?? "",
      p_phone: supplier.phone ?? "", p_email: supplier.email ?? "", p_address: supplier.address ?? "",
      p_notes: supplier.notes ?? "", p_status: "inactive", p_categories: mappings ?? []
    });
    if (error) throw new Error("Supplier could not be archived.");
    refreshSupplierViews();
    return { ok: true, message: "Supplier archived. Historical stock and delivery records were preserved.", supplierId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Supplier could not be archived." };
  }
}
