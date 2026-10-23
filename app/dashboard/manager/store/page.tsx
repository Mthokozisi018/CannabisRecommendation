import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";
import { DashboardBackdrop } from "@/components/GreenChoiceDashboard";
import { ManagerStoreForm } from "@/components/manager/ManagerStoreForm";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { getOwnManagerStoreSettings } from "@/lib/manager/store-settings";

export const dynamic = "force-dynamic";

export default async function ManagerStorePage() {
  const session = await requireCompletedManagerDashboardSession();
  const settings = await getOwnManagerStoreSettings(session);

  return (
    <main className="relative isolate min-h-screen px-4 py-6 text-white sm:px-6 lg:px-[clamp(2rem,7vw,7rem)]">
      <DashboardBackdrop variant="manager" />
      <div className="relative z-10 mx-auto w-full max-w-[1180px]">
        <Link href="/dashboard/manager" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#36d179] bg-[#04100a] px-4 text-sm font-black text-white shadow-[0_12px_28px_rgba(0,0,0,0.34)] transition hover:border-[#7cf0aa] hover:bg-[#07180f] focus-visible:ring-2 focus-visible:ring-[#9bf2b5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020503]">
          <ArrowLeft size={17} aria-hidden="true" />
          Back to Manager Dashboard
        </Link>

        <header className="mt-6 rounded-lg border border-[#36d179] bg-[#031008] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.46)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="grid size-12 place-items-center rounded-full border border-[#36d179] bg-[#07130d] text-[#8df2b1]">
              <Store size={26} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-normal text-[#8df2b1]">Manager Store</p>
              <h1 className="mt-1 break-words text-3xl font-black leading-tight text-white">Manage Store</h1>
              <p className="mt-1 text-sm font-semibold text-[#b8cabe]">Update customer-facing details, opening hours, collection and delivery settings for {settings.name}.</p>
            </div>
          </div>
        </header>

        <div className="mt-5">
          <ManagerStoreForm settings={settings} />
        </div>
      </div>
    </main>
  );
}
