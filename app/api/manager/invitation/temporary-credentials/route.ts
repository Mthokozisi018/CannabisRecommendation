import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Temporary password issuance has been permanently disabled. Open a current manager invitation link."
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Vary": "Cookie, Authorization"
      }
    }
  );
}
