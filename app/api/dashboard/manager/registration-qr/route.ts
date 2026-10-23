import { getStaffRegistrationQR } from "@/lib/registration/staff-qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Retain the previous manager URL; both endpoints use the same permanent store token.
export async function GET() {
  return getStaffRegistrationQR(["manager"]);
}
