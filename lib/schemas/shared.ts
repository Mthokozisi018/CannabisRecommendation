import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const effectSlugSchema = z.enum(["relaxed", "focused", "creative", "sleepy", "euphoric", "energetic"]);
export const startRecommendationSchema = z.object({ effect: effectSlugSchema }).strict();
export const staffRoleSchema = z.enum(["admin", "receptionist", "catalog_manager"]);
export const stockStatusSchema = z.enum(["in_stock", "low_stock", "out_of_stock"]);
export const strainTypeSchema = z.enum(["Indica", "Sativa", "Hybrid"]).optional();

export const storeSwitchSchema = z
  .object({
    storeId: uuidSchema
  })
  .strict();

export const recommendationRequestSchema = z
  .object({
    effect: effectSlugSchema,
    query: z.string().trim().max(80).optional(),
    category: z.string().trim().max(60).optional(),
    subcategory: z.string().trim().max(80).optional(),
    brand: z.string().trim().max(80).optional(),
    strainType: strainTypeSchema,
    thcMin: z.coerce.number().min(0).max(100).optional(),
    thcMax: z.coerce.number().min(0).max(100).optional(),
    cbdMin: z.coerce.number().min(0).max(100).optional(),
    cbdMax: z.coerce.number().min(0).max(100).optional(),
    priceMin: z.coerce.number().min(0).max(1_000_000).optional(),
    priceMax: z.coerce.number().min(0).max(1_000_000).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.thcMin !== undefined && value.thcMax !== undefined && value.thcMin > value.thcMax) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["thcMin"], message: "THC minimum must not exceed maximum." });
    }
    if (value.priceMin !== undefined && value.priceMax !== undefined && value.priceMin > value.priceMax) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["priceMin"], message: "Price minimum must not exceed maximum." });
    }
  });

export const productImportRowSchema = z
  .object({
    slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
    categorySlug: z.string().trim().min(2).max(80),
    subcategorySlug: z.string().trim().min(2).max(80),
    name: z.string().trim().min(2).max(160),
    brand: z.string().trim().max(120).optional(),
    strainType: strainTypeSchema,
    description: z.string().trim().min(10).max(2_000),
    priceCents: z.coerce.number().int().min(0).max(5_000_000),
    sizeLabel: z.string().trim().max(80).optional(),
    thcValue: z.coerce.number().min(0).max(100).optional(),
    cbdValue: z.coerce.number().min(0).max(100).optional(),
    terpeneTotalPct: z.coerce.number().min(0).max(100).optional(),
    isLabTested: z.coerce.boolean().default(false),
    isOnSpecial: z.coerce.boolean().default(false),
    isNew: z.coerce.boolean().default(false),
    stockStatus: stockStatusSchema.default("in_stock"),
    stockOnHand: z.coerce.number().int().min(0).max(100_000).default(0),
    effects: z.array(z.object({ slug: effectSlugSchema, scorePct: z.coerce.number().int().min(0).max(100) }).strict()).min(1).max(12)
  })
  .strict();

export const productUpsertSchema = productImportRowSchema;

export const importRequestSchema = z
  .object({
    mode: z.enum(["dry_run", "commit"]).default("dry_run"),
    json: z.string().trim().min(2).max(250_000)
  })
  .strict();

export const orderTransitionSchema = z
  .object({
    orderId: uuidSchema,
    transition: z.enum(["confirm", "cancel", "complete"]),
    reason: z.string().trim().min(3).max(500).optional()
  })
  .strict();
