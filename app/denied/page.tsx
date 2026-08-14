import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { GlassPanel } from "@/components/AccountChrome";

export default function AccessDeniedPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-140px)] max-w-xl content-center px-4">
      <GlassPanel className="text-center">
        <ShieldAlert className="mx-auto size-16 text-lime-400" />
        <h1 className="mt-5 text-3xl font-bold">Insufficient permission</h1>
        <p className="mt-3 text-white/68">This workspace cannot access the requested tenant, store, account state or restricted content class. The denied access event is auditable.</p>
        <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-lg bg-lime-500 px-5 font-bold text-white">Return to account types</Link>
      </GlassPanel>
    </main>
  );
}
