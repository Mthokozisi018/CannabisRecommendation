import { z } from "zod";
import { categoryAllowsCultivationType, CULTIVATION_TYPES, isProductCategory, isValidSubcategory, PRODUCT_STATUSES, VAPE_PRODUCT_TYPES, VAPE_STRAIN_TYPES, type ProductCategory, type ProductStatus } from "@/lib/manager/options";

const requiredText = z.string().trim().min(1, "Required");
const optionalMgAmount = (label: string) => z.preprocess((input) => {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return undefined;
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return Number.NaN;
    return Number(trimmed);
  }
  return input;
}, z.number({ invalid_type_error: `${label} must be a valid non-negative number` }).finite().nonnegative(`${label} cannot be negative`).optional());
const priceAmount = z.preprocess((input) => {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return Number.NaN;
    return Number(trimmed);
  }
  return input;
}, z.number({ invalid_type_error: "Price must be a valid amount" }).nonnegative("Price cannot be negative"));
const wholeStockQuantity = (label: string, minimum: number, minimumMessage: string) =>
  z.preprocess((input) => {
    if (typeof input === "string") {
      const trimmed = input.trim();
      if (!/^\d+$/.test(trimmed)) return Number.NaN;
      return Number(trimmed);
    }
    return input;
  }, z.number({ invalid_type_error: `${label} must be a whole number` }).int(`${label} must be a whole number`).min(minimum, minimumMessage));
const optionalWholeStockQuantity = (label: string, minimum: number, minimumMessage: string) =>
  z.preprocess((input) => {
    if (typeof input === "string") {
      const trimmed = input.trim();
      if (!trimmed) return undefined;
      if (!/^\d+$/.test(trimmed)) return Number.NaN;
      return Number(trimmed);
    }
    return input;
  }, z.number({ invalid_type_error: `${label} must be a whole number` }).int(`${label} must be a whole number`).min(minimum, minimumMessage).optional());

function isVapeProductType(value: string) {
  return VAPE_PRODUCT_TYPES.includes(value as never);
}

function isVapeStrainType(value: unknown) {
  return VAPE_STRAIN_TYPES.includes(value as never);
}

function isCanonicalVapeSelection(value: { category: ProductCategory; subcategory: string; cultivationType?: string }) {
  return value.category === "Vape Cartridges" && isVapeProductType(value.subcategory);
}

function validateCategoryFilters(value: { category: ProductCategory; subcategory: string; cultivationType?: string }, ctx: z.RefinementCtx) {
  const canonicalVapeSelection = isCanonicalVapeSelection(value);
  if (!canonicalVapeSelection && !isValidSubcategory(value.category, value.subcategory)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["subcategory"], message: "Subcategory does not belong to the selected category" });
  }
  if (canonicalVapeSelection) {
    if (!isVapeStrainType(value.cultivationType)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cultivationType"], message: "Strain type is required for vape products" });
    }
    return;
  }
  if (categoryAllowsCultivationType(value.category) && !CULTIVATION_TYPES.includes(value.cultivationType as never)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cultivationType"], message: "Cultivation type is required for Flower and Pre-Rolls" });
  }
  if (!categoryAllowsCultivationType(value.category) && value.cultivationType) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cultivationType"], message: "Cultivation type is only allowed for Flower and Pre-Rolls" });
  }
}

export const productFormSchema = z.object({
  productName: requiredText,
  category: requiredText.refine(isProductCategory, "Invalid category"),
  subcategory: requiredText,
  cultivationType: z.string().trim().optional(),
  packageCount: optionalWholeStockQuantity("Package count", 1, "Package count must be greater than 0"),
  thcPerUnitMg: optionalMgAmount("THC per unit"),
  thcPerPacketMg: optionalMgAmount("Total THC per packet"),
  price: priceAmount,
  productStatus: z.enum(PRODUCT_STATUSES),
  initialStockQuantity: wholeStockQuantity("Initial stock", 0, "Initial stock cannot be negative").default(0),
  lowStockThreshold: wholeStockQuantity("Low stock threshold", 0, "Low stock threshold cannot be negative").default(5)
}).superRefine((value, ctx) => {
  validateCategoryFilters(value, ctx);
  if (value.category === "Edibles") {
    if (value.thcPerUnitMg === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["thcPerUnitMg"], message: "THC per unit is required for edible products" });
    }
    if (value.thcPerPacketMg === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["thcPerPacketMg"], message: "Total THC per packet is required for edible products" });
    }
  } else {
    if (value.packageCount !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["packageCount"], message: "Package count is only allowed for edible products" });
    }
    if (value.thcPerUnitMg !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["thcPerUnitMg"], message: "THC per unit is only allowed for edible products" });
    }
    if (value.thcPerPacketMg !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["thcPerPacketMg"], message: "Total THC per packet is only allowed for edible products" });
    }
  }
});

export const inventoryAddSchema = z.object({
  category: requiredText.refine(isProductCategory, "Invalid category"),
  subcategory: requiredText,
  cultivationType: z.string().trim().optional(),
  productId: z.string().uuid("Product is required"),
  quantityToAdd: wholeStockQuantity("Quantity to add", 1, "Quantity to add must be greater than 0"),
  reason: z.string().trim().max(300).optional()
}).superRefine((value, ctx) => {
  validateCategoryFilters(value, ctx);
});

export const productEditSchema = z.object({
  productId: z.string().uuid("Product is required"),
  category: requiredText.refine(isProductCategory, "Invalid category"),
  subcategory: requiredText,
  cultivationType: z.string().trim().optional(),
  productName: requiredText,
  packageCount: optionalWholeStockQuantity("Package count", 1, "Package count must be greater than 0"),
  thcPerUnitMg: optionalMgAmount("THC per unit"),
  thcPerPacketMg: optionalMgAmount("Total THC per packet"),
  price: priceAmount,
  productStatus: z.enum(PRODUCT_STATUSES)
}).superRefine((value, ctx) => {
  validateCategoryFilters(value, ctx);
  if (value.category === "Edibles") {
    if (value.thcPerUnitMg === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["thcPerUnitMg"], message: "THC per unit is required for edible products" });
    }
    if (value.thcPerPacketMg === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["thcPerPacketMg"], message: "Total THC per packet is required for edible products" });
    }
  } else {
    if (value.packageCount !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["packageCount"], message: "Package count is only allowed for edible products" });
    }
    if (value.thcPerUnitMg !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["thcPerUnitMg"], message: "THC per unit is only allowed for edible products" });
    }
    if (value.thcPerPacketMg !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["thcPerPacketMg"], message: "Total THC per packet is only allowed for edible products" });
    }
  }
});

export const staffCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(12, "Temporary password must be at least 12 characters").max(256),
  confirmPassword: z.string().min(1, "Confirm password is required")
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords must match"
});

export const staffActionSchema = z.object({
  staffProfileId: z.string().uuid(),
  action: z.enum(["grant", "restrict", "deactivate"]),
  managerPassword: z.string().min(1, "Enter your manager password."),
  confirmDeactivation: z.string().trim().optional()
});

export const staffResetPasswordSchema = z.object({
  staffProfileId: z.string().uuid()
}).strict();

export type ProductFormInput = {
  productName: string;
  category: ProductCategory;
  subcategory: string;
  cultivationType?: string;
  packageCount?: number;
  thcPerUnitMg?: number;
  thcPerPacketMg?: number;
  price: number;
  productStatus: ProductStatus;
  initialStockQuantity: number;
  lowStockThreshold: number;
};

export type InventoryAddInput = {
  category: ProductCategory;
  subcategory: string;
  cultivationType?: string;
  productId: string;
  quantityToAdd: number;
  reason?: string;
};

export type ProductEditInput = {
  productId: string;
  category: ProductCategory;
  subcategory: string;
  cultivationType?: string;
  productName: string;
  packageCount?: number;
  thcPerUnitMg?: number;
  thcPerPacketMg?: number;
  price: number;
  productStatus: ProductStatus;
};
