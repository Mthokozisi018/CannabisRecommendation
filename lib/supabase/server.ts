import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { assertSupabaseEnvironmentIdentity } from "@/lib/environment";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export function hasSupabaseEnv() {
  return Boolean(url && publishableKey);
}

export async function createSupabaseServerClient() {
  if (process.env.NODE_ENV === "production") assertSupabaseEnvironmentIdentity();
  if (!url || !publishableKey) return null;
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(items) {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always write refreshed cookies; proxy.ts handles refreshes.
        }
      }
    }
  });
}

export function createSupabaseAdminClient() {
  if (process.env.NODE_ENV === "production") assertSupabaseEnvironmentIdentity();
  if (!url || !secretKey) return null;
  return createClient(url, secretKey, { auth: { persistSession: false } });
}

export async function getSupabaseUserFromAccessToken(accessToken: string) {
  if (!url || !publishableKey || !accessToken) return null;
  const supabase = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error) return null;
  return data.user ?? null;
}
