import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DemoMode = "manager" | "franchise_admin" | null;

/** The database derives this from private, administrator-managed account rows. */
export async function demoModeForSession(client: SupabaseClient): Promise<DemoMode> {
  const { data, error } = await client.rpc("current_demo_access");
  if (error) throw new Error("Demo authorization could not be verified.");
  if (data === null || data === "manager" || data === "franchise_admin") return data;
  throw new Error("Demo authorization returned an invalid account type.");
}
