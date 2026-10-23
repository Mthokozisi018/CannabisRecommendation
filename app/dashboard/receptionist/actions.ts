"use server";

import { invalidateFranchiseStoreTotals } from "@/lib/franchise/totals-cache";
import { paymentSchema, paymentError } from "@/lib/pos-payment";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { invalidateStoreDisplayCache } from "@/lib/cache/redis";
import { requireStaff } from "@/lib/dal/auth";
import { registerReceptionistCustomer, searchReceptionistCustomers } from "@/lib/receptionist/customers";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { assertRateLimit, verifyOrigin } from "@/lib/security";

const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().min(0)
});

const checkoutSchema = z.object({
  payment: paymentSchema,
  checkoutId: z.string().uuid(),
  customerId: z.string().uuid("Select a customer before completing checkout."),
  items: z.array(checkoutItemSchema).min(1, "Cart is empty.").max(100, "Cart contains too many distinct products.")
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutResult = {
  ok: boolean;
  message: string;
  saleId?: string;
};

function scheduleCheckoutRefresh(storeId: string) {
  after(async () => {
    await invalidateStoreDisplayCache(storeId);
    invalidateFranchiseStoreTotals(storeId);
    revalidatePath("/dashboard/franchise", "layout");
    revalidatePath("/dashboard/receptionist/products");
    revalidatePath("/dashboard/manager");
    revalidatePath("/dashboard/manager/inventory");
    revalidatePath("/dashboard/manager/sales");
  });
}

export async function checkoutReceptionistSaleAction(input: CheckoutInput): Promise<CheckoutResult> {
  try {
    await verifyOrigin();
    const staff = await requireStaff(["manager", "receptionist"]);
    if (staff.storeAccessStatus === "restricted") throw new Error("Store access is restricted. Please contact the manager or system owner.");
    await assertRateLimit(`checkout:${staff.id}`, 20, 60_000);
    const parsed = checkoutSchema.parse(input);
    const total = parsed.items.reduce((sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity, 0) / 100;
    const invalidPayment = paymentError(parsed.payment, total);
    if (invalidPayment) throw new Error(invalidPayment);
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Supabase admin client is not configured.");

    const { data, error } = await admin.rpc("complete_receptionist_sale_v3", {
      p_checkout_id: parsed.checkoutId,
      p_auth_user_id: staff.id,
      p_customer_id: parsed.customerId,
      p_payment_method: parsed.payment.method,
      p_cash_amount: parsed.payment.cashAmount,
      p_card_amount: parsed.payment.cardAmount,
      p_items: parsed.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    });

    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes("complete_receptionist_sale_v3") || lower.includes("pos_sales") || lower.includes("pos_customers") || lower.includes("schema cache")) {
        throw new Error("Checkout is not available yet. Review and apply the local POS customer sales migration, then try again.");
      }
      if (lower.includes("payment")) throw new Error("Payment amounts must match the final sale total. Review the payment and try again.");
      if (lower.includes("stock") || lower.includes("price") || lower.includes("product") || lower.includes("customer")) {
        throw new Error("The cart changed while checkout was processing. Review the cart and try again.");
      }
      throw new Error("Checkout could not be completed.");
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.sale_id) throw new Error("Checkout result could not be confirmed. Retry the same checkout safely.");
    scheduleCheckoutRefresh(staff.storeId);

    return {
      ok: true,
      message: row?.already_completed ? "Sale was already completed." : "Sale completed successfully.",
      saleId: row?.sale_id
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, message: error.issues[0]?.message ?? "Invalid cart." };
    }
    return { ok: false, message: error instanceof Error ? error.message : "Checkout failed. Please try again or contact the manager." };
  }
}

export async function searchReceptionistCustomersAction(input: unknown) {
  try {
    await verifyOrigin();
    const customers = await searchReceptionistCustomers(input);
    return { ok: true as const, customers };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false as const, message: error.issues[0]?.message ?? "Invalid customer search." };
    }
    return { ok: false as const, message: error instanceof Error ? error.message : "Customer search failed." };
  }
}

export async function registerReceptionistCustomerAction(input: unknown) {
  try {
    await verifyOrigin();
    const result = await registerReceptionistCustomer(input);
    return { ok: true as const, ...result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false as const, message: error.issues[0]?.message ?? "Check the customer details." };
    }
    return { ok: false as const, message: error instanceof Error ? error.message : "Customer registration failed." };
  }
}
