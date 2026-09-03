import "server-only";
import { z } from "zod";
import { requireStaff } from "@/lib/dal/auth";
import { customerFullName, normalizePOSCustomerPhone } from "@/lib/pos-customer-format";
import { assertRateLimit } from "@/lib/security";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type ReceptionistCustomerSearchMode = "phone" | "name";

export type ReceptionistPOSCustomer = {
  id: string;
  fullName: string;
  firstName: string;
  surname: string;
  phoneNumber: string;
};

const searchSchema = z.object({
  mode: z.enum(["phone", "name"]),
  query: z.string().trim().min(2, "Enter at least two characters.").max(80)
});

const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Name is required.").max(80),
  surname: z.string().trim().min(1, "Surname is required.").max(80),
  phoneNumber: z.string().trim().min(9, "Cellphone number is required.").max(30)
});

type POSCustomerRow = {
  id: string;
  first_name: string;
  surname: string;
  phone_display: string | null;
  phone_normalized: string;
};

function customerFromRow(row: POSCustomerRow): ReceptionistPOSCustomer {
  return {
    id: row.id,
    firstName: row.first_name,
    surname: row.surname,
    fullName: customerFullName(row.first_name, row.surname),
    phoneNumber: row.phone_display || row.phone_normalized
  };
}

function unavailableCustomerMessage(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("pos_customers") || lower.includes("schema cache") || lower.includes("does not exist");
}

export async function searchReceptionistCustomers(input: unknown) {
  const parsed = searchSchema.parse(input);
  const staff = await requireStaff(["manager", "receptionist"]);
  await assertRateLimit(`receptionist:customer-search:${staff.id}`, 60, 60_000);
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Customer search is temporarily unavailable.");

  const normalizedPhone = normalizePOSCustomerPhone(parsed.query);
  let query = supabase
    .from("pos_customers")
    .select("id, first_name, surname, phone_display, phone_normalized")
    .eq("store_id", staff.storeId)
    .is("deleted_at", null)
    .limit(8);

  if (parsed.mode === "phone") {
    const digits = parsed.query.replace(/\D/g, "");
    query = normalizedPhone
      ? query.eq("phone_normalized", normalizedPhone.normalized)
      : query.ilike("phone_digits", `%${digits}%`);
  } else {
    const term = parsed.query.replace(/[%_,]/g, "").trim();
    query = query.or(`first_name.ilike.%${term}%,surname.ilike.%${term}%,full_name.ilike.%${term}%`);
  }

  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) {
    if (unavailableCustomerMessage(error.message)) throw new Error("Customer records are temporarily unavailable.");
    throw new Error("Customer search failed.");
  }
  return ((data ?? []) as POSCustomerRow[]).map(customerFromRow);
}

export async function registerReceptionistCustomer(input: unknown) {
  const parsed = registerSchema.parse(input);
  const staff = await requireStaff(["manager", "receptionist"]);
  await assertRateLimit(`receptionist:customer-register:${staff.id}`, 12, 60_000);
  const phone = normalizePOSCustomerPhone(parsed.phoneNumber);
  if (!phone) throw new Error("Enter a valid South African cellphone number.");
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Customer registration is temporarily unavailable.");

  const { data: existing, error: existingError } = await admin
    .from("pos_customers")
    .select("id, first_name, surname, phone_display, phone_normalized")
    .eq("store_id", staff.storeId)
    .eq("phone_normalized", phone.normalized)
    .is("deleted_at", null)
    .maybeSingle<POSCustomerRow>();

  if (existingError) {
    if (unavailableCustomerMessage(existingError.message)) throw new Error("Customer records are temporarily unavailable.");
    throw new Error("Customer duplicate check failed.");
  }
  if (existing) return { customer: customerFromRow(existing), duplicate: true };

  const { data, error } = await admin
    .from("pos_customers")
    .insert({
      store_id: staff.storeId,
      first_name: parsed.firstName,
      surname: parsed.surname,
      full_name: customerFullName(parsed.firstName, parsed.surname),
      phone_normalized: phone.normalized,
      phone_digits: phone.digits,
      phone_display: phone.display,
      created_by_user_id: staff.id,
      updated_by_user_id: staff.id
    })
    .select("id, first_name, surname, phone_display, phone_normalized")
    .single<POSCustomerRow>();

  if (error) {
    if (error.code === "23505") {
      const { data: duplicate } = await admin
        .from("pos_customers")
        .select("id, first_name, surname, phone_display, phone_normalized")
        .eq("store_id", staff.storeId)
        .eq("phone_normalized", phone.normalized)
        .maybeSingle<POSCustomerRow>();
      if (duplicate) return { customer: customerFromRow(duplicate), duplicate: true };
    }
    if (unavailableCustomerMessage(error.message)) throw new Error("Customer records are temporarily unavailable.");
    throw new Error("Customer registration failed.");
  }

  return { customer: customerFromRow(data), duplicate: false };
}
