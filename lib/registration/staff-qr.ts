import "server-only";
import { NextResponse } from "next/server";
import type { StaffRole } from "@/lib/types";
import { generateRegistrationPoster } from "@/lib/registration/poster";
import { requireStaff } from "@/lib/dal/auth";
import { getStoreRegistrationUrl } from "@/lib/registration/url";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { StaffAuthenticationRequiredError } from "@/lib/auth-errors";
export async function getStaffRegistrationQR(roles: StaffRole[] = ["manager", "receptionist"]) {
  const headers = { "Cache-Control": "private, no-store" };
  let stage = "staff-authentication";
  let storeId: string | undefined;
  let databaseCode: string | undefined;
  try {
    const staff = await requireStaff(roles);
    storeId = staff.storeId;
    if (!storeId) return NextResponse.json({ error: "Your staff profile has no assigned store.", code: "store_unassigned" }, { status: 409, headers });
    if (staff.storeAccessStatus === "restricted") return NextResponse.json({ error: "Store access is restricted." }, { status: 403, headers });
    stage = "server-database-configuration";
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error();
    stage = "store-lookup";
    const store = await admin.from("stores").select("name,is_active,store_access_status").eq("id", storeId).single();
    databaseCode = store.error?.code;
    if (store.error || !store.data || !store.data.is_active || (store.data.store_access_status && store.data.store_access_status !== "active")) throw new Error();
    // New stores are provisioned once. Concurrent opens never rotate an existing token.
    stage = "token-provisioning";
    const provisioned = await admin.from("store_registration_tokens").upsert({ store_id: storeId }, { onConflict: "store_id", ignoreDuplicates: true });
    databaseCode = provisioned.error?.code;
    if (provisioned.error) throw new Error();
    stage = "token-lookup";
    const token = await admin.from("store_registration_tokens").select("token,revoked_at,expires_at").eq("store_id", storeId).single();
    databaseCode = token.error?.code;
    if (token.error || !token.data) throw new Error();
    if (token.data.revoked_at || (token.data.expires_at && Date.parse(token.data.expires_at) <= Date.now())) return NextResponse.json({ error: "This store's registration link is inactive. Ask your administrator to review it.", code: "token_inactive" }, { status: 409, headers });
    stage = "registration-url";
    const link = getStoreRegistrationUrl({ registrationToken: token.data.token });
    stage = "qr-image-generation";
    const image = await generateRegistrationPoster(link);
    return NextResponse.json({ storeName: store.data.name, link, image }, { headers });
  } catch (error) {
    // No credentials, public tokens, customer details or raw database messages.
    console.error("[store-registration-qr] failed", { stage, storeId, databaseCode });
    if (error instanceof StaffAuthenticationRequiredError) return NextResponse.json({ error: "Sign in with your staff account to load the store QR code.", code: "authentication_required" }, { status: 401, headers });
    if (stage === "staff-authentication") return NextResponse.json({ error: "Your staff account cannot access this store's registration QR code.", code: "access_denied" }, { status: 403, headers });
    const schemaMissing = ["PGRST205", "42P01"].includes(databaseCode ?? "");
    return NextResponse.json({ error: schemaMissing ? "Store QR setup is incomplete. Your administrator must apply the store registration QR token migration." : "Unable to generate QR. Please retry or contact your administrator.", code: schemaMissing ? "qr_schema_missing" : "qr_unavailable", stage }, { status: 503, headers });
  }
}
