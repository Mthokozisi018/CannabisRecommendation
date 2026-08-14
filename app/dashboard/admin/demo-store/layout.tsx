import { requireAdminDemoStoreContext } from "@/lib/admin/demo-store";

export const dynamic = "force-dynamic";

export default async function AdminDemoStoreLayout({ children }: { children: React.ReactNode }) {
  await requireAdminDemoStoreContext();
  return <>{children}</>;
}
