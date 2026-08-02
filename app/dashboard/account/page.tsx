import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { AccountManagementForms, type DashboardAccountProfile } from "@/components/account/DashboardAccountPanel";
import { DashboardBackdrop } from "@/components/GreenChoiceDashboard";
import { requireDashboardRoleSession, type DashboardSession } from "@/lib/dashboard-session";

export const dynamic = "force-dynamic";

function accountProfileFromSession(session: DashboardSession): DashboardAccountProfile {
  return {
    firstName: session.profile.first_name ?? session.displayName.split(/\s+/)[0] ?? "",
    surname: session.profile.surname ?? "",
    email: session.email,
    phoneNumber: session.profile.phone_number ?? session.profile.mobile_number ?? "",
    alternativePhone: session.profile.alternative_phone ?? "",
    physicalAddress: session.profile.physical_address ?? "",
    city: session.profile.city ?? "",
    province: session.profile.province ?? "",
    postalCode: session.profile.postal_code ?? "",
    country: session.profile.country ?? "South Africa",
    employeeId: session.profile.employee_id ?? ""
  };
}

function roleTitle(session: DashboardSession) {
  return session.isManager ? "Manager" : "Receptionist";
}

export default async function DashboardAccountPage() {
  const session = await requireDashboardRoleSession(["manager", "employee_receptionist"]);
  const role = session.isManager ? "manager" : "receptionist";
  const backHref = session.isManager ? "/dashboard/receptionist" : "/dashboard/receptionist";
  const title = roleTitle(session);

  return (
    <main className="relative isolate min-h-screen px-4 py-6 text-white sm:px-6 lg:px-[clamp(2rem,7vw,7rem)]">
      <DashboardBackdrop variant={session.isManager ? "manager" : "receptionist"} />
      <div className="relative z-10 mx-auto w-full max-w-[1100px]">
        <Link href={backHref as never} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#36d179] bg-[#04100a] px-4 text-sm font-black text-white shadow-[0_12px_28px_rgba(0,0,0,0.34)] transition hover:border-[#7cf0aa] hover:bg-[#07180f] focus-visible:ring-2 focus-visible:ring-[#9bf2b5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020503]">
          <ArrowLeft size={17} aria-hidden="true" />
          Back to POS
        </Link>

        <header className="mt-6 rounded-lg border border-[#36d179] bg-[#031008] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.46)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="grid size-12 place-items-center rounded-full border border-[#36d179] bg-[#07130d] text-[#8df2b1]">
              <UserRound size={26} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-normal text-[#8df2b1]">{title} Account</p>
              <h1 className="mt-1 break-words text-3xl font-black leading-tight text-white">Manage Account</h1>
            </div>
          </div>
        </header>

        <div className="mt-5">
          <AccountManagementForms role={role} profile={accountProfileFromSession(session)} />
        </div>
      </div>
    </main>
  );
}
