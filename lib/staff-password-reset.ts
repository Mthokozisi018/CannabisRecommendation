import "server-only";
import { createClient } from "@supabase/supabase-js";
import { configuredApplicationUrl } from "@/lib/app-url";

export async function sendStaffPasswordResetLink(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
    redirectTo: `${configuredApplicationUrl()}/update-password`
  });
}
