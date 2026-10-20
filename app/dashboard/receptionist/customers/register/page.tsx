import { BackLink, DashboardHeader, GlassPanel } from "@/components/GreenChoiceDashboard";
import { requireStaff } from "@/lib/dal/auth";
import { StaffCustomerOnboarding } from "@/components/registration/StaffCustomerOnboarding";
export default async function RegisterCustomerRecordPage() {
  await requireStaff(["manager", "receptionist"]);
  return <main className="mx-auto max-w-5xl px-4 py-8"><BackLink href="/dashboard/receptionist/products" visualStyle="receptionist" /><DashboardHeader title="Customer Registration" subtitle="Assist a customer or share your store's registration QR code." profileLabel="Receptionist profile" /><GlassPanel><div className="flex flex-wrap gap-3"><StaffCustomerOnboarding /></div><p className="mt-4 leading-7">Both methods use the same store registration form, document checks and required agreements.</p><p className="mt-4 leading-7">After registration succeeds, search the customer&apos;s cellphone number in Select Customer and link their profile to the sale.</p></GlassPanel></main>;
}
