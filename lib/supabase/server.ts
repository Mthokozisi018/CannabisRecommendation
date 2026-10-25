import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { assertSupabaseEnvironmentIdentity } from "@/lib/environment";
import { createSupabaseFetch } from "@/lib/supabase/fetch";
import { supabaseSessionCookieNames } from "@/lib/supabase/session-cookies";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseFetch = createSupabaseFetch();

type SupabaseServerClientOptions = {
  clearExistingSessionCookies?: boolean;
};

export function hasSupabaseEnv() {
  return Boolean(url && publishableKey);
}

function clearSessionCookiesFromStore(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const names = supabaseSessionCookieNames(cookieStore.getAll(), url);
  for (const name of names) {
    cookieStore.set(name, "", {
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
  }
  return names;
}

export async function clearSupabaseServerSessionCookies() {
  const cookieStore = await cookies();
  try {
    return clearSessionCookiesFromStore(cookieStore);
  } catch {
    return [];
  }
}

export async function createSupabaseServerClient(options: SupabaseServerClientOptions = {}) {
  assertSupabaseEnvironmentIdentity();
  if (!url || !publishableKey) return null;
  const cookieStore = await cookies();
  if (options.clearExistingSessionCookies) {
    clearSessionCookiesFromStore(cookieStore);
  }
  return createServerClient(url, publishableKey, {
    cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    global: {
      fetch: supabaseFetch
    },
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
  assertSupabaseEnvironmentIdentity();
  if (!url || !secretKey) return null;
  return createClient(url, secretKey, {
    auth: { persistSession: false },
    global: { fetch: supabaseFetch }
  });
}

export async function getSupabaseUserFromAccessToken(accessToken: string) {
  if (!url || !publishableKey || !accessToken) return null;
  const supabase = createClient(url, publishableKey, {
    auth: { persistSession: false },
    global: { fetch: supabaseFetch }
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error) return null;
  return data.user ?? null;
}
