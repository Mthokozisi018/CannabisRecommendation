import { z } from "zod";
import { isProductCategory, type ProductCategory } from "@/lib/manager/options";
import { supplierSubcategories } from "@/lib/manager/supplier-options";

const optionalContact = (maximum: number) => z.string().trim().max(maximum).optional().default("");

export const supplierCategorySchema = z.object({
  category: z.string().trim().refine(isProductCategory, "Select a valid category."),
  subcategory: z.string().trim().min(1, "Select a subcategory.")
}).superRefine((value, ctx) => {
  if (!isProductCategory(value.category)) return;
  if (!supplierSubcategories(value.category).includes(value.subcategory as never)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["subcategory"], message: "Subcategory does not belong to the selected category." });
  }
});

export const supplierFormSchema = z.object({
  supplierId: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Supplier name is required.").max(160),
  contactPerson: optionalContact(160),
  phone: optionalContact(40),
  email: z.string().trim().max(254).refine((value) => value === "" || z.string().email().safeParse(value).success, "Enter a valid email address.").default(""),
  address: optionalContact(500),
  streetAddress: optionalContact(240),
  suburb: optionalContact(160),
  city: optionalContact(160),
  postalCode: optionalContact(20),
  status: z.enum(["active", "inactive"]),
  categories: z.array(supplierCategorySchema).min(1, "Add at least one category and subcategory.")
}).superRefine((value, ctx) => {
  const seen = new Set<string>();
  value.categories.forEach((mapping, index) => {
    const key = `${mapping.category}\u0000${mapping.subcategory}`;
    if (seen.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["categories", index], message: "This category and subcategory is already selected." });
    seen.add(key);
  });
});

export type SupplierFormInput = z.infer<typeof supplierFormSchema>;
export type SupplierCategoryInput = { category: ProductCategory; subcategory: string };
