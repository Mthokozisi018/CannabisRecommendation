import Link from "next/link";
export default function BillingRestrictedPage() {
  return <main className="grid min-h-screen place-items-center bg-[#061b13] p-4 text-white"><section className="max-w-lg rounded-2xl border border-amber-300/40 bg-[#0b2b20] p-7 text-center"><h1 className="text-2xl font-bold">Billing needs attention</h1><p className="mt-3 text-white/75">Ask your business billing owner to resolve the GreenChoice subscription. Your store data remains available once billing is restored.</p><Link href="/login" className="mt-5 inline-block text-emerald-300 underline">Return to sign in</Link></section></main>;
}
