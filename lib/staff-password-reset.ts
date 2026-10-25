import "server-only";
import { configuredApplicationUrl } from "@/lib/app-url";
import { createSupabaseRecoveryClient } from "@/lib/supabase/recovery";

export async function sendStaffPasswordResetLink(email: string) {
  const supabase = createSupabaseRecoveryClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
    redirectTo: `${configuredApplicationUrl()}/update-password?flow=recovery`
  });
  if (error) throw new Error("The password-reset email could not be sent. Please retry later.");
}
