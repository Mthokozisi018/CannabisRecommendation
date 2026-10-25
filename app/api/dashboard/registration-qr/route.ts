import { getStaffRegistrationQR } from "@/lib/registration/staff-qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return getStaffRegistrationQR();
}
