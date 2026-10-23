"use client";

import { createContext, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { notifySalesLoading, salesLoadingFailed, salesLoadingReady, salesLoadingStart } from "./sales-loading-events";
import styles from "./Franchise.module.css";

const salesRoute = "/dashboard/franchise/sales";
const loadingTimeoutMs = 120_000;
export const FranchiseSalesLoadingContext = createContext(false);

// Lives in the persistent franchise layout, before a cold sales route can compile.
export function FranchiseSalesNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "timeout" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearTimer() {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    }
    function start() {
      clearTimer();
      flushSync(() => setStatus("loading"));
      timer.current = setTimeout(() => setStatus("timeout"), loadingTimeoutMs);
    }
    function finish() {
      clearTimer();
      setStatus(null);
    }
    function click(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[data-navigation-loading="franchise-sales"]') : null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      start();
    }
    document.addEventListener("click", click, true);
    window.addEventListener(salesLoadingStart, start);
    window.addEventListener(salesLoadingReady, finish);
    window.addEventListener(salesLoadingFailed, finish);
    window.addEventListener("pageshow", finish);
    window.addEventListener("popstate", finish);
    return () => {
      clearTimer();
      document.removeEventListener("click", click, true);
      window.removeEventListener(salesLoadingStart, start);
      window.removeEventListener(salesLoadingReady, finish);
      window.removeEventListener(salesLoadingFailed, finish);
      window.removeEventListener("pageshow", finish);
      window.removeEventListener("popstate", finish);
    };
  }, []);

  const eligible = pathname === "/dashboard/franchise" || pathname.startsWith(salesRoute);
  const overlay = status === "timeout" ? (
    <div className="greenchoice-loader-overlay">
      <section role="alert" className={styles.panel}>
        <h2>Sales Performance is taking longer than expected</h2>
        <p className={styles.muted}>The page could not finish loading. Please try again.</p>
        <button className={styles.button} onClick={() => {
          notifySalesLoading(salesLoadingStart);
          if (pathname === "/dashboard/franchise") router.push(salesRoute);
          else router.refresh();
        }}>Try again</button>
      </section>
    </div>
  ) : <LoadingOverlay active={status === "loading"} label="Loading Franchise Sales Performance" />;
  return <FranchiseSalesLoadingContext.Provider value={eligible && status !== null}>
    {children}
    {eligible ? overlay : null}
  </FranchiseSalesLoadingContext.Provider>;
}
