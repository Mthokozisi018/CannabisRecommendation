import Link from "next/link";

export default function CustomerAccountUnavailablePage() {
  return <main className="grid min-h-screen place-items-center bg-[#f4f7f4] px-5 text-[#102018]"><section className="max-w-lg rounded-3xl border-2 border-[#e2d7d7] bg-white p-8 text-center"><h1 className="text-3xl font-black">Account unavailable</h1><p className="mt-3 text-[#657069]">This customer account cannot currently access GreenChoice. Contact support if you believe this is a mistake.</p><Link href="/login" className="mt-6 inline-flex rounded-xl bg-[#087c39] px-6 py-3 font-black text-white">Return to sign in</Link></section></main>;
}
