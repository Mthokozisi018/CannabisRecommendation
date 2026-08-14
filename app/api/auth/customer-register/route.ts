import { NextResponse } from "next/server";
import { configuredApplicationUrl } from "@/lib/app-url";
import { CUSTOMER_PHYSICAL_ID_NOTICE_VERSION, CUSTOMER_PRIVACY_VERSION, CUSTOMER_TERMS_VERSION } from "@/lib/customer/constants";
import { customerIdFingerprint, customerRegistrationSchema, normalizeSouthAfricanPhone, validateSouthAfricanId } from "@/lib/customer/validation";
import { RateLimitExceededError, RateLimitUnavailableError, rateLimitHeaders, requireRateLimit, trustedClientIp } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/security";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie, Authorization" };

export async function POST(request: Request) {
  let createdUserId: string | null = null;
  let stage = "request-validation";
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "Invalid request." }, { status: 415, headers: privateHeaders });
    }
    stage = "origin-verification";
    await verifyOrigin();
    stage = "payload-validation";
    const parsed = customerRegistrationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your registration details." }, { status: 400, headers: privateHeaders });
    }

    const phoneNumber = normalizeSouthAfricanPhone(parsed.data.phoneNumber);
    if (!phoneNumber) {
      return NextResponse.json({ error: "Enter a valid South African mobile number." }, { status: 400, headers: privateHeaders });
    }
    const idResult = validateSouthAfricanId(parsed.data.southAfricanId);
    if (!idResult.valid) {
      return NextResponse.json({ error: idResult.message }, { status: 400, headers: privateHeaders });
    }

    stage = "rate-limit";
    const rateLimit = await requireRateLimit({
      namespace: "customer-register",
      identifiers: [trustedClientIp(request.headers), parsed.data.email, phoneNumber],
      limit: 5,
      windowMs: 60 * 60 * 1000
    });
    const responseHeaders = { ...privateHeaders, ...rateLimitHeaders(rateLimit) };
    const admin = createSupabaseAdminClient();
    const supabase = await createSupabaseServerClient();
    if (!admin || !supabase) {
      return NextResponse.json({ error: "Customer registration is temporarily unavailable." }, { status: 503, headers: responseHeaders });
    }

    stage = "identity-fingerprint";
    const idFingerprint = customerIdFingerprint(parsed.data.southAfricanId);
    stage = "duplicate-check";
    const { data: duplicate, error: duplicateError } = await admin
      .from("customer_profiles")
      .select("user_id")
      .or(`email.eq.${parsed.data.email},phone_number.eq.${phoneNumber},id_fingerprint.eq.${idFingerprint}`)
      .limit(1)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) {
      return NextResponse.json({ error: "A GreenChoice customer account already exists for these details. Use account recovery instead of creating another account." }, { status: 409, headers: responseHeaders });
    }

    stage = "auth-sign-up";
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${configuredApplicationUrl()}/auth/callback?next=/customer`,
        data: { greenchoice_registration: "customer" }
      }
    });
    if (signUpError || !signUpData.user || signUpData.user.identities?.length === 0) {
      return NextResponse.json({ error: "This email may already have an account. Use Forgot Password or Forgot Account Details." }, { status: 409, headers: responseHeaders });
    }
    createdUserId = signUpData.user.id;
    const now = new Date().toISOString();

    stage = "customer-profile";
    const { error: profileError } = await admin.from("customer_profiles").insert({
      user_id: createdUserId,
      first_name: parsed.data.firstName,
      surname: parsed.data.surname,
      email: parsed.data.email,
      phone_number: phoneNumber,
      id_fingerprint: idFingerprint,
      id_last_four: idResult.lastFour,
      date_of_birth: idResult.dateOfBirth,
      age_verified_at: now,
      status: signUpData.user.email_confirmed_at ? "active" : "pending_verification",
      email_verified_at: signUpData.user.email_confirmed_at,
      terms_version: CUSTOMER_TERMS_VERSION,
      terms_accepted_at: now,
      privacy_policy_version: CUSTOMER_PRIVACY_VERSION,
      privacy_policy_accepted_at: now,
      physical_id_notice_accepted_at: now,
      marketing_consent: parsed.data.marketingConsent
    });
    if (profileError) throw profileError;

    stage = "customer-related-records";
    const [{ error: addressError }, { error: preferenceError }, { error: consentError }] = await Promise.all([
      admin.from("customer_addresses").insert({
        user_id: createdUserId,
        label: "Home",
        street_address: parsed.data.streetAddress,
        unit_details: parsed.data.unitDetails || null,
        suburb: parsed.data.suburb,
        city: parsed.data.city,
        province: parsed.data.province,
        postal_code: parsed.data.postalCode,
        country: "South Africa",
        is_default: true
      }),
      admin.from("customer_preferences").insert({ user_id: createdUserId, promotional_notifications: parsed.data.marketingConsent }),
      admin.from("customer_consents").insert([
        { user_id: createdUserId, consent_type: "terms", policy_version: CUSTOMER_TERMS_VERSION, accepted: true, accepted_at: now },
        { user_id: createdUserId, consent_type: "privacy", policy_version: CUSTOMER_PRIVACY_VERSION, accepted: true, accepted_at: now },
        { user_id: createdUserId, consent_type: "physical_id_notice", policy_version: CUSTOMER_PHYSICAL_ID_NOTICE_VERSION, accepted: true, accepted_at: now },
        { user_id: createdUserId, consent_type: "marketing", policy_version: CUSTOMER_PRIVACY_VERSION, accepted: parsed.data.marketingConsent, accepted_at: now }
      ])
    ]);
    if (addressError || preferenceError || consentError) throw addressError || preferenceError || consentError;

    return NextResponse.json({
      created: true,
      requiresEmailVerification: !signUpData.user.email_confirmed_at,
      redirectTo: signUpData.user.email_confirmed_at ? "/customer" : "/customer/verify-email",
      message: "Your GreenChoice customer account has been created. Keep your email and password safe—you will need them whenever you sign in."
    }, { status: 201, headers: responseHeaders });
  } catch (error) {
    const errorDetails = typeof error === "object" && error !== null
      ? error as { name?: unknown; code?: unknown }
      : null;
    console.error("[customer-register] failed", {
      stage,
      errorName: typeof errorDetails?.name === "string" ? errorDetails.name : "UnknownError",
      errorCode: typeof errorDetails?.code === "string" ? errorDetails.code : undefined
    });
    if (createdUserId) {
      const admin = createSupabaseAdminClient();
      await admin?.auth.admin.deleteUser(createdUserId).catch(() => undefined);
    }
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json({ error: error.message }, { status: 429, headers: { ...privateHeaders, ...rateLimitHeaders(error.result) } });
    }
    if (error instanceof RateLimitUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503, headers: privateHeaders });
    }
    return NextResponse.json({ error: "We could not create the customer account. Please try again." }, { status: 500, headers: privateHeaders });
  }
}
