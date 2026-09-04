import Link from "next/link";
import { CreditCard, LockKeyhole, LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { logoutGreenChoiceStaffAction } from "@/app/actions";
import { DashboardBackdrop } from "@/components/GreenChoiceDashboard";
import { getDashboardSession } from "@/lib/dashboard-session";

export const dynamic = "force-dynamic";

export default async function BillingRestrictedPage() {
  const session = await getDashboardSession();
  if (!session) redirect("/login");

  return (
    <>
      <DashboardBackdrop variant={session.isReceptionist ? "receptionist" : "manager"} />
      <main className="grid min-h-screen place-items-center px-4 py-10 text-white">
        <section className="w-full max-w-2xl rounded-[24px] border border-[#7e3f35] bg-[#140d0b] p-7 text-center shadow-[0_28px_90px_rgba(0,0,0,0.55)] sm:p-10">
          <span className="mx-auto grid size-20 place-items-center rounded-full border border-[#c65a4d] bg-[#35140f] text-[#ff9c87]">
            <LockKeyhole size={38} />
          </span>
          <h1 className="mt-6 text-3xl font-black sm:text-4xl">Subscription Payment Required</h1>
          <p className="mx-auto mt-4 max-w-xl text-base font-medium leading-7 text-white/68">
            The GreenChoice subscription grace period for {session.storeName} has ended. Store data is preserved, but normal dashboard access is paused until billing is restored.
          </p>

          {session.isManager ? (
            <Link href="/manager/subscription" className="mt-7 inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[#4de873] px-6 font-black text-[#031007] transition hover:bg-[#74f18f]">
              <CreditCard size={20} /> Fix Payment & Restore Access
            </Link>
          ) : (
            <p className="mx-auto mt-7 max-w-lg rounded-xl border border-[#6f5d28] bg-[#28200c] px-5 py-4 text-sm font-bold leading-6 text-[#f5d474]">
              Please ask your store manager to update the GreenChoice subscription payment method.
            </p>
          )}

          <form action={logoutGreenChoiceStaffAction} className="mt-5">
            <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#211714] px-5 text-sm font-bold text-white/80 transition hover:border-white/30 hover:text-white">
              <LogOut size={17} /> Log out
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
