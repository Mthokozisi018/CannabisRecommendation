import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type CustomerProfile = {
  user_id: string;
  first_name: string;
  surname: string;
  email: string;
  phone_number: string;
  id_last_four: string;
  date_of_birth: string;
  status: "pending_verification" | "active" | "suspended" | "erasure_requested" | "deleted";
  email_verified_at: string | null;
  phone_verified_at: string | null;
  marketing_consent: boolean;
  created_at: string;
};

export type CustomerSession = {
  user: User;
  profile: CustomerProfile;
  displayName: string;
};

const CUSTOMER_PROFILE_SELECT = "user_id,first_name,surname,email,phone_number,id_last_four,date_of_birth,status,email_verified_at,phone_verified_at,marketing_consent,created_at";

export async function getCustomerSessionForVerifiedUser(user: User): Promise<CustomerSession | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("customer_profiles")
    .select(CUSTOMER_PROFILE_SELECT)
    .eq("user_id", user.id)
    .maybeSingle<CustomerProfile>();
  if (error) throw new Error("Unable to read the customer account.");
  if (!data || data.status === "deleted") return null;

  let profile = data;
  if (profile.status === "pending_verification" && user.email_confirmed_at) {
    const admin = createSupabaseAdminClient();
    const verifiedAt = user.email_confirmed_at;
    const { data: activated, error: activationError } = await admin
      ?.from("customer_profiles")
      .update({ status: "active", email_verified_at: verifiedAt })
      .eq("user_id", user.id)
      .eq("status", "pending_verification")
      .select(CUSTOMER_PROFILE_SELECT)
      .maybeSingle<CustomerProfile>() ?? { data: null, error: null };
    if (activationError) throw new Error("Unable to activate the verified customer account.");
    if (activated) profile = activated;
  }

  return { user, profile, displayName: profile.first_name };
}

const getCustomerSessionCached = cache(async () => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ? getCustomerSessionForVerifiedUser(data.user) : null;
});

export async function getCustomerSession() {
  return getCustomerSessionCached();
}

export async function requireCustomerSession() {
  const session = await getCustomerSession();
  if (!session) redirect("/login?error=customer-account" as never);
  if (session.profile.status === "pending_verification") redirect("/customer/verify-email" as never);
  if (session.profile.status !== "active") redirect("/customer/account-unavailable" as never);
  return session;
}

