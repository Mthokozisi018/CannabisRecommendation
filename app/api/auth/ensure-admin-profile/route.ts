import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { error: "Automatic administrator provisioning is disabled." },
    { status: 410, headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}
