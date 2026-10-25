import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { requireDashboardRoleSession } from "@/lib/dashboard-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FranchiseStore } from "./types";

export const requireFranchiseAdmin = cache(async (setup = false) => {
  const session = await requireDashboardRoleSession(["franchise_admin"]);
  if (
    session.profile.role !== "franchise_admin" ||
    !session.profile.franchise_id
  )
    throw new Error("Franchise assignment required.");
  if (!setup && !session.accountSetupComplete)
    redirect("/franchise/setup" as never);
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    throw new Error("Franchise access is temporarily unavailable.");
  return { session, supabase, franchiseId: session.profile.franchise_id };
});

export const requireFranchiseStore = cache(async (storeId: string) => {
  const context = await requireFranchiseAdmin();
  const { data, error } = await context.supabase
    .from("stores")
    .select(
      "id,franchise_id,name,slug,is_active,store_access_status,physical_store_address,city,province,postal_code,store_phone_number,store_contact_email,store_image_url,opening_hours,created_at",
    )
    .eq("id", storeId)
    .eq("franchise_id", context.franchiseId)
    .maybeSingle<FranchiseStore>();
  if (error) throw new Error("Store information could not be loaded.");
  if (!data || data.franchise_id !== context.franchiseId)
    throw new Error("Store not found in your franchise.");
  return { ...context, store: data };
});
