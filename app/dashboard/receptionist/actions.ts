"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { invalidateStoreDisplayCache } from "@/lib/cache/redis";
import { requireStaff } from "@/lib/dal/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { assertRateLimit, verifyOrigin } from "@/lib/security";

const POS_CUSTOMER_COOKIE = "greenchoice_pos_checkout_customer";

const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().min(0)
});

const checkoutSchema = z.object({
  checkoutId: z.string().uuid(),
  items: z.array(checkoutItemSchema).min(1, "Cart is empty.").max(100, "Cart contains too many distinct products.")
});

const customerSelectionSchema = z.object({
  customerId: z.string().uuid()
});

const customerSearchSchema = z.object({
  mode: z.enum(["phone", "name"]),
  query: z.string().trim().min(2, "Enter at least 2 characters.").max(80)
});

const customerRegistrationSchema = z.object({
  firstName: z.string().trim().min(1, "Enter the customer's name.").max(80),
  surname: z.string().trim().min(1, "Enter the customer's surname.").max(80),
  phoneNumber: z.string().trim().min(9, "Enter a valid cellphone number.").max(24)
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutResult = {
  ok: boolean;
  message: string;
  saleId?: string;
};

export type POSCustomerSummary = {
  id: string;
  firstName: string;
  surname: string;
  phoneNumber: string;
};

export type CustomerSearchResult = {
  ok: boolean;
  message?: string;
  customers: POSCustomerSummary[];
};

export type CustomerRegistrationResult = {
  ok: boolean;
  message: string;
  customer?: POSCustomerSummary;
  newlyRegisteredToStore?: boolean;
};

export type CustomerSelectionResult = {
  ok: boolean;
  message: string;
};

function normalizeSouthAfricanPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (/^0[0-9]{9}$/.test(digits)) return `+27${digits.slice(1)}`;
  if (/^27[0-9]{9}$/.test(digits)) return `+${digits}`;
  throw new Error("Enter a valid South African cellphone number, for example 082 123 4567.");
}

function normalizePhoneSearch(value: string) {
  const digits = value.replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? digits.slice(1) : digits.startsWith("27") ? digits.slice(2) : digits;
  if (normalized.length < 2) throw new Error("Enter at least 2 cellphone digits.");
  return normalized;
}

function customerFromRpcRow(row: Record<string, unknown> | null | undefined): POSCustomerSummary | null {
  if (!row) return null;
  const id = typeof row.customer_id === "string" ? row.customer_id : "";
  const firstName = typeof row.first_name === "string" ? row.first_name : "";
  const surname = typeof row.surname === "string" ? row.surname : "";
  const phoneNumber = typeof row.phone_number === "string" ? row.phone_number : "";
  if (!id || !firstName || !surname || !phoneNumber) return null;
  return { id, firstName, surname, phoneNumber };
}

function scheduleCheckoutRefresh(storeId: string) {
  after(async () => {
    await invalidateStoreDisplayCache(storeId);
    revalidatePath("/dashboard/receptionist/products");
    revalidatePath("/dashboard/manager");
    revalidatePath("/dashboard/manager/inventory");
    revalidatePath("/dashboard/manager/sales");
  });
}

export async function searchReceptionistCustomersAction(input: unknown): Promise<CustomerSearchResult> {
  try {
    await verifyOrigin();
    const staff = await requireStaff(["manager", "receptionist"]);
    if (staff.storeAccessStatus === "restricted") throw new Error("Store access is restricted.");
    await assertRateLimit(`pos-customer-search:${staff.id}`, 80, 60_000);

    const parsed = customerSearchSchema.parse(input);
    const query = parsed.mode === "phone" ? normalizePhoneSearch(parsed.query) : parsed.query;
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Customer search is unavailable.");

    const { data, error } = await admin.rpc("search_store_pos_customers", {
      p_auth_user_id: staff.id,
      p_mode: parsed.mode,
      p_query: query,
      p_limit: 8
    });

    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes("search_store_pos_customers") || lower.includes("schema cache")) {
        throw new Error("Customer lookup is not available yet. Apply the POS customer migration first.");
      }
      throw new Error("Customer lookup failed. Please try again.");
    }

    const customers = (Array.isArray(data) ? data : [])
      .map((row) => customerFromRpcRow(row as Record<string, unknown>))
      .filter((customer): customer is POSCustomerSummary => Boolean(customer));

    return { ok: true, customers };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, message: error.issues[0]?.message ?? "Invalid customer search.", customers: [] };
    }
    return { ok: false, message: error instanceof Error ? error.message : "Customer lookup failed.", customers: [] };
  }
}

export async function registerReceptionistCustomerAction(input: unknown): Promise<CustomerRegistrationResult> {
  try {
    await verifyOrigin();
    const staff = await requireStaff(["manager", "receptionist"]);
    if (staff.storeAccessStatus === "restricted") throw new Error("Store access is restricted.");
    await assertRateLimit(`pos-customer-register:${staff.id}`, 20, 60_000);

    const parsed = customerRegistrationSchema.parse(input);
    const phoneNumber = normalizeSouthAfricanPhone(parsed.phoneNumber);
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Customer registration is unavailable.");

    const { data, error } = await admin.rpc("register_store_pos_customer", {
      p_auth_user_id: staff.id,
      p_first_name: parsed.firstName,
      p_surname: parsed.surname,
      p_phone_number: phoneNumber
    });

    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes("register_store_pos_customer") || lower.includes("schema cache")) {
        throw new Error("Customer registration is not available yet. Apply the POS customer migration first.");
      }
      throw new Error("Customer registration failed. Please try again.");
    }

    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    const customer = customerFromRpcRow(row);
    if (!customer) throw new Error("Customer registration returned an invalid record.");

    return {
      ok: true,
      message: row?.newly_registered_to_store === false ? "Existing customer added to this store." : "Customer registered successfully.",
      customer,
      newlyRegisteredToStore: row?.newly_registered_to_store !== false
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, message: error.issues[0]?.message ?? "Invalid customer details." };
    }
    return { ok: false, message: error instanceof Error ? error.message : "Customer registration failed." };
  }
}

export async function selectReceptionistCheckoutCustomerAction(input: unknown): Promise<CustomerSelectionResult> {
  try {
    await verifyOrigin();
    const staff = await requireStaff(["manager", "receptionist"]);
    if (staff.storeAccessStatus === "restricted") throw new Error("Store access is restricted.");
    const parsed = customerSelectionSchema.parse(input);
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Customer selection is unavailable.");

    const { count, error } = await admin
      .from("store_customer_registrations")
      .select("customer_id", { count: "exact", head: true })
      .eq("store_id", staff.storeId)
      .eq("customer_id", parsed.customerId);

    if (error || count !== 1) throw new Error("Select a customer registered with this store.");

    const cookieStore = await cookies();
    cookieStore.set(POS_CUSTOMER_COOKIE, parsed.customerId, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/dashboard/receptionist",
      maxAge: 10 * 60
    });

    return { ok: true, message: "Customer selected." };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: "Invalid customer selection." };
    return { ok: false, message: error instanceof Error ? error.message : "Customer selection failed." };
  }
}

export async function checkoutReceptionistSaleAction(input: CheckoutInput): Promise<CheckoutResult> {
  try {
    await verifyOrigin();
    const staff = await requireStaff(["manager", "receptionist"]);
    if (staff.storeAccessStatus === "restricted") throw new Error("Store access is restricted. Please contact the manager or system owner.");
    await assertRateLimit(`checkout:${staff.id}`, 20, 60_000);
    const parsed = checkoutSchema.parse(input);
    const cookieStore = await cookies();
    const selectedCustomerId = cookieStore.get(POS_CUSTOMER_COOKIE)?.value;
    const customer = customerSelectionSchema.safeParse({ customerId: selectedCustomerId });
    if (!customer.success) throw new Error("Select a customer before completing checkout.");

    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Supabase admin client is not configured.");

    const { data, error } = await admin.rpc("complete_receptionist_sale_v3", {
      p_checkout_id: parsed.checkoutId,
      p_auth_user_id: staff.id,
      p_customer_id: customer.data.customerId,
      p_items: parsed.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    });

    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes("complete_receptionist_sale_v3") || lower.includes("pos_customers") || lower.includes("schema cache")) {
        throw new Error("Customer checkout is not available yet. Apply the POS customer migration, then try again.");
      }
      if (lower.includes("customer")) {
        throw new Error("The selected customer is no longer available for this store. Select the customer again.");
      }
      if (lower.includes("stock") || lower.includes("price") || lower.includes("product")) {
        throw new Error("The cart changed while checkout was processing. Review the cart and try again.");
      }
      throw new Error("Checkout could not be completed.");
    }

    const row = Array.isArray(data) ? data[0] : data;
    cookieStore.set(POS_CUSTOMER_COOKIE, "", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/dashboard/receptionist",
      maxAge: 0
    });
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
