import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Cookie, Authorization"
};

export async function GET() {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("unavailable");
    const { error } = await admin.from("staff_profiles").select("id", { head: true, count: "exact" }).limit(1);
    if (error) throw new Error("unavailable");
    return NextResponse.json({ ready: true }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ ready: false }, { status: 503, headers: privateHeaders });
  }
}
