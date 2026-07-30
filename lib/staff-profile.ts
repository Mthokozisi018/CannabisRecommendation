import type { StaffRole } from "@/lib/types";

export type StaffProfileRow = {
  id: string;
  auth_user_id: string;
  user_id?: string | null;
  store_id?: string | null;
  email: string;
  full_name?: string | null;
  first_name?: string | null;
  surname?: string | null;
  role: "admin" | "manager" | "receptionist";
  is_active?: boolean | null;
  account_status?: "active" | "restricted" | "deactivated" | "deleted" | null;
  account_setup_complete?: boolean | null;
  profile_setup_complete?: boolean | null;
  store_setup_complete?: boolean | null;
  onboarding_complete_seen_at?: string | null;
  temporary_password_active?: boolean | null;
  password_changed_at?: string | null;
  terms_accepted_at?: string | null;
  privacy_policy_accepted_at?: string | null;
  terms_version?: string | null;
  privacy_policy_version?: string | null;
  stores?: {
    id: string;
    slug: string;
    name: string;
    store_access_status?: "active" | "restricted" | null;
  } | {
    id: string;
    slug: string;
    name: string;
    store_access_status?: "active" | "restricted" | null;
  }[] | null;
};

export type CurrentStaffUser = {
  authUserId: string;
  email: string;
  fullName: string;
  role: "admin" | "manager" | "receptionist";
  isActive: boolean;
};

export function profileRoleToStaffRole(role: StaffProfileRow["role"]): StaffRole {
  if (role === "admin") return "admin";
  return role === "manager" ? "manager" : "receptionist";
}

export function staffProfileToCurrentUser(profile: StaffProfileRow): CurrentStaffUser {
  const fullName = profile.full_name ?? [profile.first_name, profile.surname].filter(Boolean).join(" ");
  return {
    authUserId: profile.user_id ?? profile.auth_user_id,
    email: profile.email,
    fullName,
    role: profile.role,
    isActive: profile.account_status ? profile.account_status === "active" : profile.is_active === true
  };
}
