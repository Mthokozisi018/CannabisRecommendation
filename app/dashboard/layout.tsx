import { SessionActivityMonitor } from "@/components/SessionActivityMonitor";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionActivityMonitor />
      {children}
    </>
  );
}
