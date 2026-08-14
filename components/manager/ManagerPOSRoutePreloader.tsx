"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const MANAGER_FAST_ROUTES = [
  "/dashboard/manager/inventory/manage",
  "/dashboard/manager/inventory",
  "/dashboard/manager/staff",
  "/dashboard/receptionist"
] as const;

export function ManagerPOSRoutePreloader() {
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/dashboard/receptionist");

    const requestIdleCallback = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 1));
    const cancelIdleCallback = window.cancelIdleCallback ?? window.clearTimeout;
    const idleId = requestIdleCallback(() => {
      for (const route of MANAGER_FAST_ROUTES) router.prefetch(route);
    });

    return () => cancelIdleCallback(idleId);
  }, [router]);

  return null;
}
