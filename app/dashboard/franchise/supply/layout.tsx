import { DashboardBackdrop } from "@/components/DashboardBackdrop";

export default function MasterSupplyLayout({ children }: { children: React.ReactNode }) {
  return <div className="relative isolate min-h-screen"><DashboardBackdrop variant="receptionist" />{children}</div>;
}
