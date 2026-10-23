import { z } from "zod";
import type { MasterProduct, SupplyDistribution, SupplyRequest } from "@/lib/master-supply/data";

// A fixed technical limit, unrelated to the private central balance.
export const REQUEST_QUANTITY_LIMIT = 1_000_000;
export const supplyRequestSchema = z.object({
  id: z.string().uuid(),
  expectedStoreId: z.string().uuid(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(REQUEST_QUANTITY_LIMIT) }).strict()).min(1).max(100)
    .refine(items => new Set(items.map(item => item.productId)).size === items.length, "Each product may appear only once."),
  notes: z.string().trim().max(500),
}).strict();

export type CatalogueProduct = Pick<MasterProduct, "id" | "sku" | "name" | "category" | "subcategory" | "strain_type" | "cultivation_type" | "image_url"> & { available: boolean };
export type ManagerSupplyContext = { store_id: string; store_name: string; franchise_id: string; franchise_name: string };
export type ManagerSupplyRequestsData = { context: ManagerSupplyContext; products: CatalogueProduct[]; requests: SupplyRequest[]; distributions: SupplyDistribution[] };

export function managerRequestStatus(request: SupplyRequest, distributions: SupplyDistribution[]) {
  if (["fulfilled", "partially_fulfilled", "rejected"].includes(request.status)) return request.status;
  return distributions.some(row => row.request_id === request.id && row.status !== "cancelled") ? "in_distribution" : request.status;
}
