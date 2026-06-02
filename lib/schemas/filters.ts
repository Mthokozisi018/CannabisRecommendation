import { z } from "zod";
import type { ProductFilters } from "@/lib/types";

const optionalNumber = z
  .union([z.string(), z.number(), z.undefined(), z.null()])
  .transform((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  });

export const filtersSchema = z.object({
  query: z.string().trim().max(80).optional().catch(undefined),
  category: z.string().trim().max(64).optional().catch(undefined),
  subcategory: z.string().trim().max(80).optional().catch(undefined),
  strainType: z.string().trim().max(40).optional().catch(undefined),
  growType: z.string().trim().max(40).optional().catch(undefined),
  brand: z.string().trim().max(80).optional().catch(undefined),
  inStockOnly: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional().transform((value) => value === true || value === "true"),
  thcMin: optionalNumber,
  thcMax: optionalNumber,
  cbdMin: optionalNumber,
  cbdMax: optionalNumber,
  priceMin: optionalNumber,
  priceMax: optionalNumber,
  dietary: z.string().trim().max(40).optional().catch(undefined),
  ratioTag: z.string().trim().max(40).optional().catch(undefined),
  hardwareFacet: z.string().trim().max(40).optional().catch(undefined),
  concentrateSubtype: z.string().trim().max(40).optional().catch(undefined),
  view: z.enum(["grid", "list"]).optional().catch(undefined)
});

export function parseFilters(input: Record<string, unknown>): ProductFilters {
  const parsed = filtersSchema.parse(input);
  return Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== undefined && value !== "")) as ProductFilters;
}

export function filtersFromSearchParams(params: URLSearchParams, category?: string): ProductFilters {
  const raw = Object.fromEntries(params.entries());
  return parseFilters({ ...raw, category: category ?? raw.category });
}
