import { z } from "zod";
import { CULTIVATION_TYPES, isProductCategory, isValidSubcategory, type ProductCategory } from "./options";
import { inventoryAddBaseSchema, productFormBaseSchema, productFormSchema } from "./validation";

export function hasAddStockClassification(category: string) {
  return category === "Flower" || category === "Pre-Rolls";
}

function classification(value: { category: ProductCategory; subcategory: string; cultivationType?: string }, ctx: z.RefinementCtx) {
  if (!isProductCategory(value.category)) return;
  if (!isValidSubcategory(value.category, value.subcategory)) {
    ctx.addIssue({ code: "custom", path: ["subcategory"], message: "Select a valid product type." });
  }
  if (hasAddStockClassification(value.category)) {
    if (!CULTIVATION_TYPES.includes(value.cultivationType as never)) ctx.addIssue({ code: "custom", path: ["cultivationType"], message: "Select a cultivation type." });
  } else if (value.cultivationType) {
    ctx.addIssue({ code: "custom", path: ["cultivationType"], message: "Strain and cultivation fields only apply to Flower and Pre-Rolls." });
  }
}

const supplierFields = {
  supplierId: z.string().uuid("Select a supplier before adding stock."),
  supplierUnitCost: z.preprocess((value) => typeof value === "string" && /^\d+(\.\d{1,2})?$/.test(value.trim()) ? Number(value) : value,
    z.number({ error: "Enter a valid supplier unit cost." }).finite().nonnegative("Supplier unit cost cannot be negative."))
};

export const addStockReceiptSchema = inventoryAddBaseSchema.extend(supplierFields).superRefine((value, ctx) => {
  // Old vape records store their strain in subcategory; receipts never rewrite those records.
  const legacyVape = value.category === "Vape Cartridges" && ["Sativa", "Indica", "Hybrid"].includes(value.subcategory);
  classification(legacyVape ? { ...value, subcategory: "Vape Cartridge" } : value, ctx);
});
export const addStockProductSchema = productFormBaseSchema.extend(supplierFields).superRefine((value, ctx) => {
  if (!isProductCategory(value.category)) return;
  classification(value, ctx);
  // Reuse the existing non-classification product rules, including edible THC requirements.
  const legacyInput = value.category === "Vape Cartridges" ? { ...value, cultivationType: "Hybrid" } : value;
  const legacy = productFormSchema.safeParse(legacyInput);
  if (!legacy.success) for (const issue of legacy.error.issues) ctx.addIssue(issue);
});
