"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActiveManager } from "@/lib/manager/auth";
import { CULTIVATION_TYPES, isProductCategory, PRODUCT_SUBCATEGORIES } from "@/lib/manager/options";
import { hasAddStockClassification } from "@/lib/manager/add-stock-validation";
import type { AddStockSupplier } from "@/lib/manager/add-stock-suppliers";
import { assertRateLimit, verifyOrigin } from "@/lib/security";

export type AddStockSupplierState = { ok: boolean; message: string; supplier?: AddStockSupplier };
const schema = z.object({
  name: z.string().trim().min(2, "Enter a supplier name.").max(160),
  contactPerson: z.string().trim().max(160),
  email: z.union([z.literal(""), z.string().trim().email()]),
  phone: z.string().trim().max(40),
  category: z.string().refine(isProductCategory, "Select a category."),
  subcategory: z.string().min(1, "Select a product type first.")
}).superRefine((value, ctx) => {
  if (!isProductCategory(value.category)) return;
  const allowed = hasAddStockClassification(value.category) ? CULTIVATION_TYPES : PRODUCT_SUBCATEGORIES[value.category];
  if (!allowed.includes(value.subcategory as never)) ctx.addIssue({ code: "custom", message: "Select a valid supplier category.", path: ["subcategory"] });
});

export async function registerAddStockSupplier(_previous: AddStockSupplierState, form: FormData): Promise<AddStockSupplierState> {
  try {
    await verifyOrigin();
    const { supabase, user } = await requireActiveManager();
    await assertRateLimit(`manager:supplier-save:${user.id}`, 30, 60 * 60_000);
    const parsed = schema.parse(Object.fromEntries(["name", "contactPerson", "email", "phone", "category", "subcategory"].map((key) => [key, form.get(key) ?? ""])));
    const categories = [{ category: parsed.category, subcategory: parsed.subcategory }];
    const { data, error } = await supabase.rpc("save_supplier_atomic", {
      p_supplier_id: null, p_name: parsed.name, p_contact_person: parsed.contactPerson,
      p_phone: parsed.phone, p_email: parsed.email, p_address: "", p_notes: "", p_status: "active", p_categories: categories
    });
    if (error) return { ok: false, message: error.message.includes("duplicate_supplier") ? "This supplier already exists in your store. Select the existing supplier." : "Supplier could not be saved. Please try again." };
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.supplier_id) throw new Error("Supplier could not be saved.");
    revalidatePath("/dashboard/manager/inventory/manage");
    return { ok: true, message: "Supplier registered.", supplier: { id: result.supplier_id, name: parsed.name, categories } };
  } catch (error) {
    return { ok: false, message: error instanceof z.ZodError ? error.issues[0].message : error instanceof Error ? error.message : "Supplier could not be saved." };
  }
}
