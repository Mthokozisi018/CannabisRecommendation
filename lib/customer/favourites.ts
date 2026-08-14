import "server-only";
import { requireCustomerSession } from "@/lib/customer/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listCustomerFavouriteIds() {
  const session = await requireCustomerSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { storeIds: [] as string[], productIds: [] as string[] };
  const { data, error } = await supabase.from("customer_favourites").select("store_id,product_id").eq("user_id", session.user.id);
  if (error) throw new Error("Unable to load saved items.");
  return {
    storeIds: (data ?? []).flatMap((item) => item.store_id ? [item.store_id] : []),
    productIds: (data ?? []).flatMap((item) => item.product_id ? [item.product_id] : [])
  };
}

