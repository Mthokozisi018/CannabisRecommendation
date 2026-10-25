export type Franchise = {
  id: string;
  name: string;
  registration_number: string | null;
  contact_email: string;
  phone: string;
  address: string;
  created_at: string;
};
export type FranchiseStore = {
  id: string;
  franchise_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  store_access_status: string;
  physical_store_address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  store_phone_number: string | null;
  store_contact_email: string | null;
  store_image_url: string | null;
  opening_hours: Record<
    string,
    { closed?: boolean; open?: string; close?: string }
  > | null;
  created_at: string;
};
export type FranchiseStaff = {
  id: string;
  auth_user_id: string;
  store_id: string;
  full_name: string | null;
  first_name: string | null;
  surname: string | null;
  email: string;
  phone_number: string | null;
  mobile_number: string | null;
  role: "manager" | "receptionist";
  account_status: string;
  assigned_at: string | null;
  created_at: string;
};
export type LoginRecord = {
  id: string;
  user_id: string;
  store_id: string;
  created_at: string;
  result: string;
  details: {
    role?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
};
export type FranchiseActionState = {
  ok: boolean;
  message: string;
  id?: string;
};
export const FRANCHISE_STORE_IMAGE = "/images/franchise/store-default.png";
