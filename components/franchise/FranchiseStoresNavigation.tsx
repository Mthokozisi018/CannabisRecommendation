"use client";

import { createContext, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { notifyStoresLoading, storesLoadingFailed, storesLoadingReady, storesLoadingStart } from "./stores-loading-events";
import styles from "./Franchise.module.css";

const storesRoute = "/dashboard/franchise/stores";
const loadingTimeoutMs = 120_000;
export const FranchiseStoresLoadingContext = createContext(false);

// Lives in the persistent franchise layout so clicks receive immediate feedback.
export function FranchiseStoresNavigation({ children }: { children: React.ReactNode }) {
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
      setStatus("loading");
      timer.current = setTimeout(() => setStatus("timeout"), loadingTimeoutMs);
    }
    function finish() {
      clearTimer();
      setStatus(null);
    }
    function click(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[data-navigation-loading="franchise-stores"]') : null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== storesRoute) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      flushSync(start);
    }
    document.addEventListener("click", click, true);
    window.addEventListener(storesLoadingStart, start);
    window.addEventListener(storesLoadingReady, finish);
    window.addEventListener(storesLoadingFailed, finish);
    window.addEventListener("pageshow", finish);
    window.addEventListener("popstate", finish);
    return () => {
      clearTimer();
      document.removeEventListener("click", click, true);
      window.removeEventListener(storesLoadingStart, start);
      window.removeEventListener(storesLoadingReady, finish);
      window.removeEventListener(storesLoadingFailed, finish);
      window.removeEventListener("pageshow", finish);
      window.removeEventListener("popstate", finish);
    };
  }, []);

  const eligible = pathname === "/dashboard/franchise" || pathname.startsWith(storesRoute);
  const overlay = status === "timeout" ? (
    <div className="greenchoice-loader-overlay">
      <section role="alert" className={styles.panel}>
        <h2>Manage Stores is taking longer than expected</h2>
        <p className={styles.muted}>The page could not finish loading. Please try again.</p>
        <button className={styles.button} onClick={() => {
          notifyStoresLoading(storesLoadingStart);
          if (pathname.startsWith(storesRoute)) router.refresh();
          else router.push(storesRoute);
        }}>Try again</button>
      </section>
    </div>
  ) : <LoadingOverlay active={status === "loading"} label="Loading Franchise Manage Stores" />;
  return <FranchiseStoresLoadingContext.Provider value={eligible && status !== null}>
    {children}
    {eligible ? overlay : null}
  </FranchiseStoresLoadingContext.Provider>;
}
