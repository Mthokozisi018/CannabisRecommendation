import { redirect } from "next/navigation";
import { Sprout } from "lucide-react";
import { ReceptionistAccountSetupForm } from "@/components/staff/ReceptionistAccountSetupForm";
import { requireDashboardRoleSession } from "@/lib/dashboard-session";
import { getLegalDocumentStatus } from "@/lib/manager/legal-documents";

export const dynamic = "force-dynamic";

export default async function ReceptionistAccountSetupPage() {
  const session = await requireDashboardRoleSession(["employee_receptionist"]);
  if (session.accountSetupComplete) redirect("/dashboard/receptionist" as never);
  const legal = getLegalDocumentStatus();

  return (
    <main className="relative isolate min-h-screen overflow-x-hidden px-4 py-7 text-white sm:px-6">
      <div className="absolute inset-0 -z-20 bg-[#020503]" />
      <div className="absolute inset-0 -z-10 bg-[url('/images/manager/manage-staff-wallpaper.png')] bg-cover bg-center bg-no-repeat" />
      <div className="absolute inset-0 -z-10 bg-black/55" />
      <section className="mx-auto w-full max-w-[900px] text-center">
        <div className="flex items-center justify-center gap-3">
          <Sprout size={38} className="text-lime-300" fill="currentColor" />
          <p className="text-2xl font-extrabold">Green<span className="text-[#72d943]">Choice</span></p>
        </div>
        <ReceptionistAccountSetupForm termsHref={legal.termsHref} privacyHref={legal.privacyHref} />
      </section>
    </main>
  );
}
