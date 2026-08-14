import Link from "next/link";
import { LayoutDashboard, Store, UsersRound } from "lucide-react";
import { AdminPageShell } from "@/components/admin/AdminDashboardUI";
import { GlassPanel } from "@/components/GreenChoiceDashboard";
import { getOrCreateAdminDemoStore } from "@/lib/admin/demo-store";

export const dynamic = "force-dynamic";

const demoEntrypoints = [
  {
    href: "/dashboard/admin/demo-store/manager",
    title: "Manager Dashboard",
    icon: LayoutDashboard
  },
  {
    href: "/dashboard/admin/demo-store/receptionist",
    title: "Receptionist Dashboard",
    icon: UsersRound
  }
];

export default async function AdminDemoStorePage() {
  const demoStore = await getOrCreateAdminDemoStore();

  return (
    <AdminPageShell eyebrow="Demo Store">
      <section className="mb-10">
        <div className="mb-6 grid size-16 place-items-center rounded-full border border-lime-300/45 bg-lime-400/12 text-lime-300 shadow-[0_0_34px_rgba(132,229,89,0.18)]">
          <Store size={34} />
        </div>
        <h1 className="text-4xl font-extrabold sm:text-5xl">Demo Store</h1>
        <p className="mt-4 text-xl text-white/75">{demoStore.name}</p>
      </section>

      <GlassPanel className="grid gap-7 md:grid-cols-2">
        {demoEntrypoints.map((entry) => {
          const Icon = entry.icon;
          return (
            <Link key={entry.href} href={entry.href as never} className="group flex min-h-[260px] flex-col items-center justify-between rounded-2xl border border-lime-400/35 bg-[linear-gradient(145deg,rgba(4,35,18,0.74),rgba(0,8,7,0.8))] p-7 text-center shadow-[0_24px_90px_rgba(0,0,0,0.38)] transition hover:-translate-y-1 hover:border-lime-300/80">
              <span className="grid size-24 place-items-center rounded-full border border-lime-400/45 bg-lime-400/10 text-lime-300 shadow-[0_0_36px_rgba(125,232,75,0.2)]">
                <Icon size={48} />
              </span>
              <span className="block text-3xl font-extrabold">{entry.title}</span>
              <span className="inline-flex h-14 w-full max-w-sm items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-lime-500 to-green-800 text-lg font-bold transition group-hover:brightness-110">
                Open {entry.title}
              </span>
            </Link>
          );
        })}
      </GlassPanel>
    </AdminPageShell>
  );
}
