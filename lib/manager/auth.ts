import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActiveManagerDashboardSession } from "@/lib/dashboard-session";

const requireActiveManagerCached = cache(async () => {
  const session = await requireActiveManagerDashboardSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return { supabase, user: session.user, profile: session.profile };
});

export async function requireActiveManager() {
  return requireActiveManagerCached();
}

export function requireAdminClient() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin client is not configured.");
  return admin;
}
