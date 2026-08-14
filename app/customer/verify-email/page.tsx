import Link from "next/link";
import { MailCheck } from "lucide-react";

export default function VerifyCustomerEmailPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7f4] px-5 text-[#102018]">
      <section className="w-full max-w-lg rounded-3xl border-2 border-[#dce5df] bg-white p-8 text-center shadow-xl">
        <MailCheck className="mx-auto text-[#159447]" size={58} />
        <h1 className="mt-5 text-3xl font-black">Verify your email</h1>
        <p className="mt-3 text-[#5f6e65]">Open the verification email from GreenChoice, then follow the secure link to activate your customer account.</p>
        <p className="mt-5 rounded-xl border-2 border-[#bfe5ca] bg-[#eaf8ee] p-4 text-sm font-semibold text-[#19582e]">Keep your email and password safe. You will need them whenever you sign in.</p>
        <Link href="/login" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-[#087c39] px-6 font-black text-white">Return to sign in</Link>
      </section>
    </main>
  );
}

