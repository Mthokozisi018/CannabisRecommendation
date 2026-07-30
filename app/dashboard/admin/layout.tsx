import { requireAdmin } from "@/lib/admin-auth";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="relative min-h-screen bg-[#020805] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/admin-dashboard-wallpaper.png')" }}
      />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.76),rgba(0,0,0,0.42)_48%,rgba(0,0,0,0.72))]" />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_24%_32%,rgba(39,145,39,0.18),transparent_32%),linear-gradient(180deg,rgba(0,18,10,0.18),rgba(0,0,0,0.58))]" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
