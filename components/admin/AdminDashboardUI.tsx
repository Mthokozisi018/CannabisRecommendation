import Link from "next/link";
import { CheckCircle2, CreditCard, Link2, Send, ShieldCheck, Sparkles, Store, UserPlus, UsersRound } from "lucide-react";
import { GlassPanel } from "@/components/GreenChoiceDashboard";
import type { AdminStats } from "@/lib/admin/data";

const adminCards = [
  {
    href: "/dashboard/admin/demo-store",
    title: "Demo Store",
    text: "Open the admin demo environment for manager and receptionist walkthroughs.",
    icon: Sparkles
  },
  {
    href: "/dashboard/admin/stores",
    title: "View Stores & Managers",
    text: "View all stores and their connected manager and receptionist accounts.",
    icon: Store
  },
  {
    href: "/dashboard/admin/connect-manager",
    title: "Connect Manager",
    text: "Connect a confirmed Supabase Auth user to manager onboarding.",
    icon: Link2
  },
  {
    href: "/dashboard/admin/payments",
    title: "Payments & Subscriptions",
    text: "Manage each store's access to the GreenChoice software.",
    icon: CreditCard
  }
];

const statItems = [
  ["totalStores", "Total Stores", Store],
  ["totalManagers", "Total Managers", UsersRound],
  ["totalReceptionists", "Total Receptionists", UserPlus],
  ["activeSubscriptions", "Active Subscriptions", CreditCard]
] as const;

function BrandHeader({ eyebrow }: { eyebrow?: string }) {
  return (
    <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
      <Link href="/dashboard/admin" className="flex items-center gap-3 text-white">
        <span className="grid size-12 place-items-center rounded-full bg-lime-400/15 text-lime-300">
          <ShieldCheck size={28} />
        </span>
        <span className="text-3xl font-extrabold">Green<span className="text-[#62da2f]">Choice</span></span>
      </Link>
      {eyebrow ? <span className="rounded-full border border-lime-400/35 bg-black/30 px-5 py-3 text-sm font-semibold text-white/80">{eyebrow}</span> : null}
    </header>
  );
}

export function AdminPageShell({ children, eyebrow = "Administrator" }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <main className="relative isolate min-h-screen px-4 py-8 text-white">
      <div className="mx-auto max-w-[1500px]">
        <BrandHeader eyebrow={eyebrow} />
        {children}
        <footer className="py-8 text-center text-sm text-white/65">© 2025 <span className="text-lime-400">GreenChoice</span>. All rights reserved.</footer>
      </div>
    </main>
  );
}

export function AdminDashboardHome({ stats }: { stats: AdminStats }) {
  return (
    <AdminPageShell eyebrow="Super Admin">
      <section className="mb-10">
        <h1 className="text-4xl font-extrabold sm:text-5xl">Welcome, Administrator</h1>
        <p className="mt-4 text-xl text-white/75">Platform overview and management.</p>
      </section>

      <section className="grid gap-7 md:grid-cols-2 xl:grid-cols-4">
        {adminCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href as never} className="group flex min-h-[315px] flex-col items-center justify-between rounded-2xl border border-lime-400/35 bg-[linear-gradient(145deg,rgba(4,35,18,0.74),rgba(0,8,7,0.8))] p-7 text-center shadow-[0_24px_90px_rgba(0,0,0,0.38)] transition hover:-translate-y-1 hover:border-lime-300/80">
              <span className="grid size-28 place-items-center rounded-full border border-lime-400/45 bg-lime-400/10 text-lime-300 shadow-[0_0_36px_rgba(125,232,75,0.2)]">
                <Icon size={54} />
              </span>
              <span>
                <span className="block text-2xl font-extrabold">{card.title}</span>
                <span className="mx-auto mt-5 block h-0.5 w-28 bg-lime-400" />
                <span className="mx-auto mt-5 block max-w-64 text-lg leading-8 text-white/76">{card.text}</span>
              </span>
              <span className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-lime-500 to-green-800 text-lg font-bold transition group-hover:brightness-110">
                {card.title}
                <Send size={18} />
              </span>
            </Link>
          );
        })}
      </section>

      <GlassPanel className="mt-10 grid gap-5 md:grid-cols-4">
        {statItems.map(([key, label, Icon]) => (
          <div key={key} className="flex items-center justify-center gap-5 border-lime-400/25 py-4 md:border-r last:md:border-r-0">
            <Icon className="text-lime-400" size={36} />
            <div>
              <p className="text-4xl font-extrabold text-lime-400">{stats[key]}</p>
              <p className="mt-1 text-white/78">{label}</p>
            </div>
          </div>
        ))}
      </GlassPanel>
    </AdminPageShell>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const active = normalized === "active";
  return (
    <span className={`inline-flex w-fit items-center gap-2 rounded-md px-3 py-1 text-sm font-bold ${active ? "bg-lime-500/25 text-lime-200" : "bg-red-500/25 text-red-100"}`}>
      <CheckCircle2 size={14} />
      {active ? "Active" : normalized === "restricted" ? "Restricted" : "Deactivated"}
    </span>
  );
}
