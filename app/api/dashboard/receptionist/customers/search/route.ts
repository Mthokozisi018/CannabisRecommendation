import { NextResponse } from "next/server";
import { searchReceptionistCustomers } from "@/lib/receptionist/customers";
import { verifyOrigin } from "@/lib/security";

export const runtime = "nodejs";

// Read-only POST keeps customer names and phone numbers out of URL/access logs.
// Route handlers are not serialized in the client's Server Action queue.
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };
  try {
    await verifyOrigin();
    const customers = await searchReceptionistCustomers(await request.json(), request.signal);
    return NextResponse.json({ ok: true, customers }, { headers });
  } catch {
    return NextResponse.json({ ok: false, message: "Customer search is unavailable. Check your search or sign in again." }, { status: 400, headers });
  }
}
