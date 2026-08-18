import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CustomerRegistrationForm } from "@/app/customer/register/CustomerRegistrationForm";

export const metadata = { title: "Create Customer Account | GreenChoice" };

export default function CustomerRegisterPage() {
  return (
    <main className="min-h-screen bg-[#f4f7f4] px-4 py-6 text-[#102018] sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-3xl rounded-3xl border-2 border-[#dce5df] bg-white p-5 shadow-[0_24px_70px_rgba(17,62,35,0.12)] sm:p-9">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-[#087c39]"><ArrowLeft size={18} /> Back to sign in</Link>
        <div className="my-7 border-b-2 border-[#e5ebe7] pb-7">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#159447]">GreenChoice</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Create your customer account</h1>
          <p className="mt-3 max-w-2xl text-[#5f6e65]">Enter your real details to browse GreenChoice stores and products securely.</p>
        </div>
        <CustomerRegistrationForm />
      </section>
    </main>
  );
}

