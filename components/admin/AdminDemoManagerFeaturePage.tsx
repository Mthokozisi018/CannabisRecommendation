import Link from "next/link";
import { BackLink, DashboardHeader, GlassPanel } from "@/components/GreenChoiceDashboard";

const demoNavigationLinks = [
  { href: "/dashboard/admin/demo-store/manager", label: "Demo Manager Dashboard" },
  { href: "/dashboard/admin/demo-store", label: "Admin Demo Store" },
  { href: "/dashboard/admin", label: "Admin Dashboard" }
];

export function AdminDemoNavigationLinks() {
  return (
    <nav className="mb-6 flex flex-wrap gap-3" aria-label="Admin demo navigation">
      {demoNavigationLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href as never}
          className="inline-flex min-h-11 items-center rounded-xl border border-lime-400/30 bg-black/35 px-4 text-sm font-semibold text-white/78 shadow-[0_0_24px_rgba(115,215,70,0.12)] backdrop-blur-xl transition hover:border-lime-300/65 hover:text-lime-300"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminDemoManagerFeaturePage({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8 text-white">
      <BackLink href="/dashboard/admin/demo-store/manager" />
      <AdminDemoNavigationLinks />
      <DashboardHeader title={title} subtitle={subtitle} profileLabel="Admin Demo" />
      <GlassPanel className="grid gap-6 md:grid-cols-2">{children}</GlassPanel>
    </main>
  );
}
