import Link from "next/link";
import { CheckCircle, Sprout } from "lucide-react";

export const dynamic = "force-dynamic";

export default function StaffInvitationCompletePage() {
  return (
    <main className="relative isolate grid min-h-screen place-items-center overflow-hidden px-6 py-10 text-center text-white">
      <div className="absolute inset-0 -z-20 bg-[#020503]" />
      <div className="absolute inset-0 -z-10 bg-[url('/images/manager/manage-staff-wallpaper.png')] bg-cover bg-center bg-no-repeat" />
      <div className="absolute inset-0 -z-10 bg-black/38" />
      <section className="max-w-2xl rounded-2xl border border-lime-400/25 bg-[#07100d]/82 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.42)] backdrop-blur-md">
        <div className="flex items-center justify-center gap-4">
          <Sprout size={50} className="text-lime-300" fill="currentColor" />
          <p className="text-3xl font-extrabold">Green<span className="text-[#72d943]">Choice</span></p>
        </div>
        <CheckCircle className="mx-auto mt-8 text-lime-300" size={72} />
        <h1 className="mt-6 text-4xl font-extrabold">Account Created Successfully</h1>
        <p className="mt-4 text-lg text-white/78">Your receptionist account is active. You can now sign in and access the Receptionist POS for your assigned store.</p>
        <Link href="/login" className="mt-7 inline-flex h-12 items-center rounded-lg bg-lime-500 px-7 font-extrabold text-black transition hover:brightness-110">Go to Login</Link>
      </section>
    </main>
  );
}
