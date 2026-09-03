"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { navigationLoadingStartEvent } from "@/components/navigation-loading-events";

const navigationTimeoutMs = 45_000;

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0;
}

function getAnchor(target: EventTarget | null) {
  return target instanceof Element ? target.closest("a") : null;
}

function shouldShowForAnchor(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const nextUrl = new URL(anchor.href, window.location.href);
  const currentUrl = new URL(window.location.href);
  if (nextUrl.origin !== currentUrl.origin) return false;
  if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) return false;

  return true;
}

export function NavigationLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const routeKey = `${pathname}?${search}`;
  const routeKeyRef = useRef(routeKey);
  const [visibleForRouteKey, setVisibleForRouteKey] = useState<string | null>(null);
  const [navigationTimedOut, setNavigationTimedOut] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    routeKeyRef.current = routeKey;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const hideTimeoutId = window.setTimeout(() => {
      setVisibleForRouteKey(null);
      setNavigationTimedOut(false);
    }, 0);
    return () => window.clearTimeout(hideTimeoutId);
  }, [routeKey]);

  useEffect(() => {
    function hide() {
      setVisibleForRouteKey(null);
      setNavigationTimedOut(false);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function show() {
      setVisibleForRouteKey(routeKeyRef.current);
      setNavigationTimedOut(false);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setNavigationTimedOut(true), navigationTimeoutMs);
    }

    function showSafeError() {
      setNavigationTimedOut(true);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || isModifiedClick(event)) return;
      const anchor = getAnchor(event.target);
      if (!anchor || !shouldShowForAnchor(anchor)) return;
      show();
    }

    document.addEventListener("click", handleClick, true);
    window.addEventListener(navigationLoadingStartEvent, show);
    window.addEventListener("pageshow", hide);
    window.addEventListener("error", showSafeError);
    window.addEventListener("unhandledrejection", showSafeError);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener(navigationLoadingStartEvent, show);
      window.removeEventListener("pageshow", hide);
      window.removeEventListener("error", showSafeError);
      window.removeEventListener("unhandledrejection", showSafeError);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  if (visibleForRouteKey !== routeKey) return null;
  if (!navigationTimedOut) return <LoadingOverlay />;

  return (
    <div className="greenchoice-loader-overlay px-4" role="alert" aria-live="assertive">
      <div className="w-full max-w-md rounded-2xl border-2 border-[#72d943] bg-[#071008] p-6 text-center text-white shadow-2xl">
        <p className="text-lg font-black">This page is taking longer than expected.</p>
        <p className="mt-2 text-sm text-white/70">Check your connection, then retry the navigation safely.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-[#72d943] px-5 py-3 font-black text-[#071007]">
          Retry
        </button>
      </div>
    </div>
  );
}
