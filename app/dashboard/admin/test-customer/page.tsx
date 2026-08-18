import Link from "next/link";
import { LogIn, ShieldCheck, UserRoundCog } from "lucide-react";
import { AdminPageShell } from "@/components/admin/AdminDashboardUI";
import { TestCustomerControls } from "@/components/admin/TestCustomerControls";
import { getTestCustomerStatus } from "@/lib/admin/test-customer";

export const dynamic = "force-dynamic";

export default async function TestCustomerPage() {
  const status = await getTestCustomerStatus();

  return (
    <AdminPageShell eyebrow="Internal QA">
      <section className="mx-auto max-w-[980px] rounded-lg border border-lime-400/45 bg-[#04100a] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:p-9">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="inline-flex size-16 items-center justify-center rounded-full border border-lime-400/50 bg-lime-400/10 text-lime-300">
              <UserRoundCog size={34} />
            </span>
            <h1 className="mt-5 text-3xl font-extrabold sm:text-4xl">Test Customer</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-white/72">Dedicated Supabase Auth customer identity for repeatable GreenChoice customer-dashboard testing.</p>
          </div>
          <Link href="/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-lime-400/55 px-4 text-sm font-bold text-lime-100 transition hover:bg-lime-400/10">
            <LogIn size={18} />
            Login
          </Link>
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <dt className="text-xs font-bold uppercase tracking-wide text-white/50">Email</dt>
            <dd className="mt-2 break-all text-lg font-bold text-white">{status.email}</dd>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <dt className="text-xs font-bold uppercase tracking-wide text-white/50">Profile</dt>
            <dd className="mt-2 text-lg font-bold text-white">{status.exists ? "Ready" : status.profileMarked ? "Profile only" : "Not created"}</dd>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <dt className="text-xs font-bold uppercase tracking-wide text-white/50">Marker</dt>
            <dd className="mt-2 text-lg font-bold text-white">{status.profileMarked ? "is_test_account=true" : "Missing"}</dd>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <dt className="text-xs font-bold uppercase tracking-wide text-white/50">Status</dt>
            <dd className="mt-2 text-lg font-bold text-white">{status.status ?? "Unknown"}</dd>
          </div>
        </dl>

        {status.missingPassword ? (
          <p className="mt-5 rounded-lg border border-amber-300/55 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100">
            Set GREENCHOICE_TEST_CUSTOMER_PASSWORD server-side before ensuring the account. The password is never displayed or logged.
          </p>
        ) : null}
        {status.missingMigration ? (
          <p className="mt-5 rounded-lg border border-amber-300/55 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100">
            Apply the customer test-account marker migration before creating or resetting this profile.
          </p>
        ) : null}

        <div className="mt-7">
          <TestCustomerControls />
        </div>

        <div className="mt-7 flex gap-3 rounded-lg border border-lime-400/25 bg-lime-400/10 p-4 text-sm leading-6 text-lime-50">
          <ShieldCheck className="mt-0.5 shrink-0 text-lime-300" size={20} />
          <p>Reset only clears saved products, carts, support requests, and temporary preferences for the configured email after the profile is marked as a test account. Auth user, profile, address, and consent history are preserved.</p>
        </div>
      </section>
    </AdminPageShell>
  );
}
