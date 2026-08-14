import { NextResponse } from "next/server";
import { z } from "zod";
import { configuredApplicationUrl } from "@/lib/app-url";
import { verifyOrigin } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(320) }).strict();
const neutralMessage = "If an account exists for this email, a password reset link has been sent.";
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie, Authorization" };

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ message: neutralMessage }, { status: 415, headers: privateHeaders });
  }
  try {
    await verifyOrigin();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: neutralMessage }, { headers: privateHeaders });
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${configuredApplicationUrl()}/update-password?flow=recovery`
      });
    }
  } catch {
    // Password recovery remains deliberately account-enumeration neutral.
  }
  return NextResponse.json({ message: neutralMessage }, { headers: privateHeaders });
}
