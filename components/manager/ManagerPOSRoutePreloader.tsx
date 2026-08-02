"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POS_ROUTE = "/dashboard/receptionist";

export function ManagerPOSRoutePreloader() {
  const router = useRouter();

  useEffect(() => {
    router.prefetch(POS_ROUTE);

    const requestIdleCallback = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 1));
    const cancelIdleCallback = window.cancelIdleCallback ?? window.clearTimeout;
    const idleId = requestIdleCallback(() => {
      router.prefetch(POS_ROUTE);
    });

    return () => cancelIdleCallback(idleId);
  }, [router]);

  return null;
}
