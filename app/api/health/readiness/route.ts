import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Authorization"
};

function isAuthorized(request: Request) {
  const expected = process.env.READINESS_DIAGNOSTIC_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  const provided = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!expected || expected.length < 32 || !provided) return false;
  const actualBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && crypto.timingSafeEqual(actualBytes, expectedBytes);
}

async function databaseIsReachable() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return false;
  const check = supabase.from("stores").select("id", { head: true }).limit(1);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("readiness_timeout")), 4_000);
  });
  try {
    const { error } = await Promise.race([check, timeout]);
    return !error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401, headers: privateHeaders });
  }

  try {
    if (!(await databaseIsReachable())) {
      return NextResponse.json({ ok: false }, { status: 503, headers: privateHeaders });
    }
    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: privateHeaders });
  }
}
