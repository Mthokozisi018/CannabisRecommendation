import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function resolveRegistrationStore(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Registration is temporarily unavailable.");
  const { data, error } = await admin.from("store_registration_tokens")
    .select("store_id, revoked_at, expires_at").eq("token", token).maybeSingle();
  if (error) throw new Error("Registration is temporarily unavailable.");
  if (!data || data.revoked_at || (data.expires_at && Date.parse(data.expires_at) <= Date.now())) return null;
  const result = await admin.from("stores").select("id, name, is_active, store_access_status").eq("id", data.store_id).maybeSingle();
  if (result.error) throw new Error("Registration is temporarily unavailable.");
  const store = result.data;
  return store?.is_active && (!store.store_access_status || store.store_access_status === "active") ? { id: store.id as string, name: store.name as string } : null;
}
