import "server-only";
import { createClient } from "@supabase/supabase-js";
import { assertSupabaseEnvironmentIdentity } from "@/lib/environment";
import { createSupabaseFetch } from "@/lib/supabase/fetch";

/** Recovery emails may be opened on a different browser from the request. */
export function createSupabaseRecoveryClient() {
  assertSupabaseEnvironmentIdentity();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: { fetch: createSupabaseFetch() }
  });
}
