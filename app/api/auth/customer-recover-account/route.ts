import { NextResponse } from "next/server";
import { z } from "zod";
import { configuredApplicationUrl } from "@/lib/app-url";
import { customerIdFingerprint, normalizeSouthAfricanPhone, validateSouthAfricanId } from "@/lib/customer/validation";
import { requireRateLimit, trustedClientIp } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/security";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ phoneNumber: z.string().trim().min(10).max(20), southAfricanId: z.string().regex(/^\d{13}$/) }).strict();
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie, Authorization" };

function maskedEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "your registered email";
  return `${name.slice(0, 2)}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
}

export async function POST(request: Request) {
  try {
    await verifyOrigin();
    const parsed = schema.safeParse(await request.json());
    const phoneNumber = parsed.success ? normalizeSouthAfricanPhone(parsed.data.phoneNumber) : null;
    const idResult = parsed.success ? validateSouthAfricanId(parsed.data.southAfricanId) : { valid: false as const };
    if (!parsed.success || !phoneNumber || !idResult.valid) return NextResponse.json({ error: "Check your phone number and South African ID number." }, { status: 400, headers: privateHeaders });
    await requireRateLimit({ namespace: "customer-account-recovery", identifiers: [trustedClientIp(request.headers), phoneNumber], limit: 5, windowMs: 60 * 60 * 1000 });
    const admin = createSupabaseAdminClient();
    const supabase = await createSupabaseServerClient();
    if (!admin || !supabase) return NextResponse.json({ error: "Account recovery is temporarily unavailable." }, { status: 503, headers: privateHeaders });
    const fingerprint = customerIdFingerprint(parsed.data.southAfricanId);
    const { data: profile } = await admin.from("customer_profiles").select("email,status").eq("phone_number", phoneNumber).eq("id_fingerprint", fingerprint).maybeSingle();
    if (profile && profile.status !== "deleted") {
      await supabase.auth.resetPasswordForEmail(profile.email, { redirectTo: `${configuredApplicationUrl()}/update-password` });
    }
    return NextResponse.json({ sent: true, message: profile ? `We sent a secure recovery link to ${maskedEmail(profile.email)}.` : "If those details match a customer account, GreenChoice has sent a secure recovery link." }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ error: "Account recovery is temporarily unavailable." }, { status: 503, headers: privateHeaders });
  }
}

