import "server-only";
import { z } from "zod";
import { safeErrorName } from "@/lib/auth-errors";
import { requireStaff } from "@/lib/dal/auth";
import { customerFullName, normalizePOSCustomerPhone } from "@/lib/pos-customer-format";
import { customerSearchClient, findIndexedPOSCustomers } from "@/lib/receptionist/customer-search-index";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  query: z.string().trim().max(80)
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

function phoneDigitsPrefix(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("27")) return `0${digits.slice(2)}`.slice(0, 10);
  if (/^[6-8]/.test(digits)) return `0${digits}`.slice(0, 10);
  return digits.slice(0, 10);
}

function nextDigitPrefix(prefix: string) {
  const chars = prefix.split("");
  for (let index = chars.length - 1; index >= 0; index -= 1) {
    if (chars[index] !== "9") {
      chars[index] = String(Number(chars[index]) + 1);
      return chars.slice(0, index + 1).join("");
    }
  }
  return null;
}

export async function searchReceptionistCustomers(input: unknown, signal?: AbortSignal) {
  const parsed = searchSchema.parse(input);
  const staff = await requireStaff(["manager", "receptionist"]);
  if (staff.storeAccessStatus === "restricted") throw new Error("Store access is restricted.");
  if (parsed.query.length < (parsed.mode === "phone" ? 3 : 2)) return [];

  // Phone lookup must reflect a just-committed QR registration immediately, even
  // while the existing search-index outbox is waiting to be processed.
  if (process.env.ELASTICSEARCH_URL && parsed.mode === "name") {
    try {
      customerSearchClient();
      const term = parsed.query.replace(/[^\p{L}\p{N} '-]/gu, "").trim();
      if (term.length < 2) return [];
      const hits = await findIndexedPOSCustomers(staff.storeId, parsed.mode, term, signal);
      if (!hits.length) return [];
      // Exact-ID hydration prevents a stale index entry from exposing a moved or deleted customer.
      const supabase = await createSupabaseServerClient();
      if (!supabase) throw new Error("Customer search is temporarily unavailable.");
      let current = supabase.from("pos_customers")
        .select("id, first_name, surname, phone_display, phone_normalized")
        .eq("store_id", staff.storeId)
        .is("deleted_at", null)
        .in("id", hits.map((hit) => hit.id));
      if (signal) current = current.abortSignal(signal);
      const { data, error } = await current;
      if (error) throw error;
      const byId = new Map(((data ?? []) as POSCustomerRow[]).map((row) => [row.id, customerFromRow(row)]));
      return hits.flatMap((hit) => byId.get(hit.id) ? [byId.get(hit.id)!] : []);
    } catch (error) {
      if (signal?.aborted) throw error;
      console.error("[customer-search] Elasticsearch unavailable; using store-scoped database search", { errorName: safeErrorName(error) });
    }
  }

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
    const digits = phoneDigitsPrefix(parsed.query);
    if (digits.length < 3) return [];
    const upperPrefix = nextDigitPrefix(digits);
    query = normalizedPhone && digits.length === 10
      ? query.eq("phone_normalized", normalizedPhone.normalized)
      : upperPrefix
        ? query.gte("phone_digits", digits).lt("phone_digits", upperPrefix)
        : query.eq("phone_digits", digits);
  } else {
    const term = parsed.query.replace(/[^\p{L}\p{N} '-]/gu, "").trim();
    if (term.length < 2) return [];
    query = query.or(`first_name.ilike.%${term}%,surname.ilike.%${term}%,full_name.ilike.%${term}%`);
  }

  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) {
    if (unavailableCustomerMessage(error.message)) {
      throw new Error("POS customer records are not available yet. Review and apply the local POS customer migration first.");
    }
    throw new Error("Customer search failed.");
  }
  return ((data ?? []) as POSCustomerRow[]).map(customerFromRow);
}

// Kept as a fail-closed boundary for older staff clients. Public QR checks are
// mandatory; staff assistance must not silently bypass document/age/consent checks.
export async function registerReceptionistCustomer(_input: unknown): Promise<{ customer: ReceptionistPOSCustomer; duplicate: boolean }> {
  void _input;
  await requireStaff(["manager", "receptionist"]);
  throw new Error("Ask the customer to scan this store's registration QR code and complete the document check. Then search for their cellphone number.");
}
