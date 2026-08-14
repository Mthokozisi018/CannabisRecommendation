import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error: "Manager invitations must be completed from the verified invitation link."
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
