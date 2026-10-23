import Link from "next/link";
import { reconcileBillingPayment } from "@/lib/billing/transactions";

export const dynamic = "force-dynamic";

export default async function PaystackCallbackPage({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const { reference } = await searchParams;
  let state: "success" | "pending" | "unknown" = "unknown";
  if (reference) {
    try { state = await reconcileBillingPayment(reference); } catch { state = "pending"; }
  }
  const message = state === "success" ? "Payment verified" : state === "pending" ? "Payment verification is pending" : "Payment reference not found";
  return <main className="grid min-h-screen place-items-center bg-[#061b13] p-4 text-white"><section className="w-full max-w-lg rounded-2xl border border-emerald-400/40 bg-[#0b2b20] p-7 text-center"><h1 className="text-2xl font-bold">{message}</h1><p className="mt-3 text-white/70">{state === "success" ? "Your GreenChoice billing record has been updated." : "Check the billing page for the latest status. Access is granted only after Paystack confirms payment."}</p><Link href={"/billing" as never} className="mt-6 inline-block rounded-lg bg-emerald-400 px-5 py-3 font-semibold text-[#052016]">Return to billing</Link></section></main>;
}
