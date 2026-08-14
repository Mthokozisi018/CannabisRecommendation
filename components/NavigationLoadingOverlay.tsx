"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { navigationLoadingStartEvent } from "@/components/navigation-loading-events";

const maxVisibleMs = 9000;

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
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    routeKeyRef.current = routeKey;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const hideTimeoutId = window.setTimeout(() => setVisibleForRouteKey(null), 0);
    return () => window.clearTimeout(hideTimeoutId);
  }, [routeKey]);

  useEffect(() => {
    function hide() {
      setVisibleForRouteKey(null);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function show() {
      setVisibleForRouteKey(routeKeyRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(hide, maxVisibleMs);
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

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener(navigationLoadingStartEvent, show);
      window.removeEventListener("pageshow", hide);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return <LoadingOverlay active={visibleForRouteKey === routeKey} />;
}
