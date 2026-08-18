import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { CUSTOMER_PHYSICAL_ID_NOTICE_VERSION, CUSTOMER_PRIVACY_VERSION, CUSTOMER_TERMS_VERSION } from "@/lib/customer/constants";
import { requireAdminUser } from "@/lib/admin/data";

const DEFAULT_TEST_CUSTOMER_EMAIL = "greenchoice.test.customer@example.invalid";
const TEST_CUSTOMER_PHONE = "+27000000000";
const TEST_CUSTOMER_ID_FINGERPRINT = "greenchoice-test-customer-id-fingerprint-v1";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

export type TestCustomerStatus = {
  configured: boolean;
  email: string;
  exists: boolean;
  authUserId: string | null;
  profileMarked: boolean;
  status: string | null;
  missingPassword: boolean;
  missingMigration: boolean;
};

export type TestCustomerActionState = {
  ok: boolean;
  message: string;
};

type CustomerProfileRow = {
  user_id: string;
  email: string;
  status: string;
  is_test_account: boolean;
};

function adminClient() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin client is not configured.");
  return admin;
}

export function getTestCustomerEmail() {
  return (process.env.GREENCHOICE_TEST_CUSTOMER_EMAIL?.trim().toLowerCase() || DEFAULT_TEST_CUSTOMER_EMAIL).slice(0, 320);
}

function getTestCustomerPassword() {
  return process.env.GREENCHOICE_TEST_CUSTOMER_PASSWORD?.trim() ?? "";
}

async function audit(action: string, recordId: string | null, details: Record<string, unknown>) {
  const staff = await requireAdminUser();
  await adminClient().from("audit_logs").insert({
    user_id: staff.id,
    action,
    table_name: "customer_profiles",
    record_id: recordId,
    result: "success",
    details
  });
}

async function authUserByEmail(admin: AdminClient, email: string) {
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("Supabase Auth users could not be checked.");
    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

function isMissingMarkerError(error: { message?: string; code?: string }) {
  return error.code === "42703" || error.message?.includes("is_test_account");
}

async function readTestProfile(admin: AdminClient, email: string, options?: { allowMissingMarker?: boolean }) {
  const { data, error } = await admin
    .from("customer_profiles")
    .select("user_id,email,status,is_test_account")
    .eq("email", email)
    .maybeSingle<CustomerProfileRow>();
  if (error && options?.allowMissingMarker && isMissingMarkerError(error)) return null;
  if (error) throw new Error("The test customer profile could not be read. Apply the test-account marker migration first.");
  return data ?? null;
}

async function requireConfiguredMarkedTestProfile(admin: AdminClient) {
  const email = getTestCustomerEmail();
  const profile = await readTestProfile(admin, email);
  if (!profile || profile.email !== email || profile.is_test_account !== true) {
    throw new Error("No marked test customer exists for the configured test email.");
  }
  return profile;
}

export async function getTestCustomerStatus(): Promise<TestCustomerStatus> {
  await requireAdminUser();
  const admin = adminClient();
  const email = getTestCustomerEmail();
  const [authUser, profile] = await Promise.all([authUserByEmail(admin, email), readTestProfile(admin, email, { allowMissingMarker: true })]);
  await audit("test_customer_accessed", profile?.user_id ?? authUser?.id ?? null, { email, profileMarked: profile?.is_test_account === true });
  return {
    configured: Boolean(email),
    email,
    exists: Boolean(authUser && profile),
    authUserId: authUser?.id ?? profile?.user_id ?? null,
    profileMarked: profile?.is_test_account === true,
    status: profile?.status ?? null,
    missingPassword: getTestCustomerPassword().length === 0,
    missingMigration: Boolean(authUser && !profile)
  };
}

export async function ensureTestCustomer() {
  const admin = adminClient();
  const email = getTestCustomerEmail();
  const password = getTestCustomerPassword();
  if (!password) throw new Error("GREENCHOICE_TEST_CUSTOMER_PASSWORD must be set server-side before creating or refreshing the test customer.");
  if (process.env.GREENCHOICE_ENV === "production") {
    throw new Error("Test customer creation is disabled in the production environment.");
  }

  const existingProfile = await readTestProfile(admin, email);
  if (existingProfile && existingProfile.is_test_account !== true) {
    throw new Error("The configured email belongs to a normal customer profile and cannot be converted here.");
  }

  const existingAuthUser = await authUserByEmail(admin, email);
  const existingMetadata = existingAuthUser?.app_metadata ?? {};
  const authResult = existingAuthUser
    ? await admin.auth.admin.updateUserById(existingAuthUser.id, {
        password,
        email_confirm: true,
        app_metadata: {
          ...existingMetadata,
          greenchoice_role: "customer",
          greenchoice_registration: "test_customer"
        }
      })
    : await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          greenchoice_role: "customer",
          greenchoice_registration: "test_customer"
        },
        user_metadata: {
          greenchoice_registration: "customer_test"
        }
      });
  if (authResult.error || !authResult.data.user) throw new Error("The Supabase Auth test customer could not be created.");

  const userId = authResult.data.user.id;
  const now = new Date().toISOString();
  const { error: profileError } = await admin.from("customer_profiles").upsert({
    user_id: userId,
    first_name: "GreenChoice",
    surname: "Test Customer",
    email,
    phone_number: TEST_CUSTOMER_PHONE,
    id_fingerprint: TEST_CUSTOMER_ID_FINGERPRINT,
    id_last_four: "0000",
    date_of_birth: "1990-01-01",
    age_verified_at: now,
    status: "active",
    email_verified_at: now,
    phone_verified_at: now,
    terms_version: CUSTOMER_TERMS_VERSION,
    terms_accepted_at: now,
    privacy_policy_version: CUSTOMER_PRIVACY_VERSION,
    privacy_policy_accepted_at: now,
    physical_id_notice_accepted_at: now,
    marketing_consent: false,
    is_test_account: true
  }, { onConflict: "user_id" });
  if (profileError) throw new Error(profileError.message);

  const { data: defaultAddress, error: addressReadError } = await admin
    .from("customer_addresses")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle<{ id: string }>();
  if (addressReadError) throw new Error(addressReadError.message);
  const addressPayload = {
    user_id: userId,
    label: "Test",
    street_address: "1 GreenChoice Test Avenue",
    suburb: "Test Suburb",
    city: "Pretoria",
    province: "Gauteng",
    postal_code: "0001",
    country: "South Africa",
    is_default: true
  };
  const addressWrite = defaultAddress
    ? await admin.from("customer_addresses").update(addressPayload).eq("id", defaultAddress.id)
    : await admin.from("customer_addresses").insert(addressPayload);
  if (addressWrite.error) throw new Error(addressWrite.error.message);

  const { error: preferencesError } = await admin.from("customer_preferences").upsert({
    user_id: userId,
    favourite_categories: [],
    default_radius_km: 15,
    open_now_only: false,
    appearance: "system",
    language: "en-ZA",
    email_notifications: true,
    sms_notifications: true,
    promotional_notifications: false
  }, { onConflict: "user_id" });
  if (preferencesError) throw new Error(preferencesError.message);

  const consents = [
    { user_id: userId, consent_type: "terms", policy_version: CUSTOMER_TERMS_VERSION, accepted: true, accepted_at: now },
    { user_id: userId, consent_type: "privacy", policy_version: CUSTOMER_PRIVACY_VERSION, accepted: true, accepted_at: now },
    { user_id: userId, consent_type: "physical_id_notice", policy_version: CUSTOMER_PHYSICAL_ID_NOTICE_VERSION, accepted: true, accepted_at: now },
    { user_id: userId, consent_type: "marketing", policy_version: CUSTOMER_PRIVACY_VERSION, accepted: false, accepted_at: now }
  ];
  const { error: consentError } = await admin.from("customer_consents").upsert(consents, { onConflict: "user_id,consent_type,policy_version" });
  if (consentError) throw new Error(consentError.message);

  await audit("test_customer_ensured", userId, { email, authUserId: userId, passwordLogged: false });
  return { email, userId };
}

export async function resetTestCustomer() {
  const admin = adminClient();
  const profile = await requireConfiguredMarkedTestProfile(admin);
  const userId = profile.user_id;

  const { data: carts, error: cartReadError } = await admin
    .from("carts")
    .select("id")
    .eq("created_by_user_id", userId);
  if (cartReadError) throw new Error(cartReadError.message);
  const cartIds = (carts ?? []).map((cart) => cart.id).filter(Boolean);
  if (cartIds.length > 0) {
    const { error: cartItemError } = await admin.from("cart_items").delete().in("cart_id", cartIds);
    if (cartItemError) throw new Error(cartItemError.message);
    const { error: cartError } = await admin.from("carts").delete().eq("created_by_user_id", userId);
    if (cartError) throw new Error(cartError.message);
  }

  const [favourites, support, preferences] = await Promise.all([
    admin.from("customer_favourites").delete().eq("user_id", userId),
    admin.from("customer_support_requests").delete().eq("user_id", userId),
    admin.from("customer_preferences").upsert({
      user_id: userId,
      favourite_categories: [],
      default_radius_km: 15,
      open_now_only: false,
      appearance: "system",
      language: "en-ZA",
      email_notifications: true,
      sms_notifications: true,
      promotional_notifications: false
    }, { onConflict: "user_id" })
  ]);
  const firstError = [favourites.error, support.error, preferences.error].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  await audit("test_customer_reset", userId, {
    email: profile.email,
    removedCartCount: cartIds.length,
    resetPreferences: true,
    preservedAuthUser: true,
    preservedProfile: true
  });
  return { email: profile.email };
}
