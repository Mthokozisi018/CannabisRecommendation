import { cookies } from "next/headers";
import { CheckCircle2 } from "lucide-react";
import { readRegistrationReceipt } from "@/lib/registration/receipt";
export const dynamic = "force-dynamic";
export const metadata = { title: "Registration Successful | GreenChoice", robots: { index: false, follow: false } };
export default async function RegistrationSuccess() {
  const receipt = readRegistrationReceipt((await cookies()).get("gc_registration_receipt")?.value);
  return <main className="flex min-h-[100dvh] items-center justify-center bg-[#f1f5f0] px-5 pb-[max(2rem,env(safe-area-inset-bottom))] text-[#14251b]" data-sentry-block><section className="w-full max-w-lg rounded-2xl border border-[#d6dfd4] bg-white p-6 text-center">
    {receipt ? <><CheckCircle2 aria-hidden size={64} className="mx-auto text-[#087c39]" /><h1 className="mt-5 text-3xl font-black">Registration Successful</h1><p className="mt-4 leading-6">You have been registered as a customer of {receipt.storeName}.</p><p className="mt-4 leading-6 text-[#526557]">A receptionist can now find and link your customer profile to a sale using your cellphone number.</p><p className="mt-5 text-xl font-bold">{receipt.maskedPhone}</p><p className="mt-3 text-sm text-[#526557]">Document number matched · Age requirement confirmed</p></> : <><h1 className="text-2xl font-black">Registration confirmation unavailable</h1><p className="mt-4 leading-6">This confirmation has expired or no registration has been completed in this browser. Ask your store for assistance.</p></>}
    <a href="/registration-complete" className="mt-6 flex min-h-14 items-center justify-center rounded-xl bg-[#087c39] px-4 font-bold text-white">Done</a>
  </section></main>;
}
