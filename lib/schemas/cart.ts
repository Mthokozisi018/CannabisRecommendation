import { z } from "zod";
import { uuidSchema } from "./shared";

export const addToCartSchema = z.object({
  cartId: uuidSchema.optional(),
  productId: uuidSchema,
  quantity: z.coerce.number().int().min(1).max(99).default(1),
  note: z.string().trim().max(240).optional()
}).strict();

export const updateCartItemSchema = z.object({
  cartId: uuidSchema,
  itemId: uuidSchema,
  quantity: z.coerce.number().int().min(0).max(99),
  note: z.string().trim().max(240).optional()
}).strict();

export const saveCartSchema = z.object({
  cartId: uuidSchema,
  note: z.string().trim().max(500).optional()
}).strict();

export const importPayloadSchema = z.object({
  mode: z.enum(["dry_run", "commit"]).default("dry_run"),
  json: z.string().trim().min(2).max(250_000)
}).strict();
