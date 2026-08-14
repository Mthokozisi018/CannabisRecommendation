"use client";

import { usePathname } from "next/navigation";

export function TopBarVisibility({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login" || pathname.startsWith("/dashboard/manager") || pathname.startsWith("/dashboard/receptionist")) return null;

  return <>{children}</>;
}
