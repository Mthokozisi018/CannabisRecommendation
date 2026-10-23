import "server-only";
import { requireCustomerSession } from "@/lib/customer/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CustomerAddress } from "@/lib/customer/address-validation";

export async function listCustomerAddresses(): Promise<CustomerAddress[]> {
  const session = await requireCustomerSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Address service is unavailable.");
  const { data, error } = await supabase.from("customer_addresses")
    .select("id,label,street_address,unit_details,suburb,city,province,postal_code,is_default")
    .eq("user_id", session.user.id).order("is_default", { ascending: false }).order("created_at");
  if (error) throw new Error("Unable to load your addresses.");
  return (data ?? []) as CustomerAddress[];
}
