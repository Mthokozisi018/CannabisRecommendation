import { z } from "zod";

export const addToCartSchema = z.object({
  cartId: z.string().uuid().optional(),
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
  note: z.string().trim().max(240).optional()
});

export const updateCartItemSchema = z.object({
  cartId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(0).max(99),
  note: z.string().trim().max(240).optional()
});

export const saveCartSchema = z.object({
  cartId: z.string().uuid(),
  note: z.string().trim().max(500).optional()
});

export const importPayloadSchema = z.object({
  json: z.string().trim().min(2).max(250_000)
});
