"use client";
import { useEffect, useSyncExternalStore } from "react";

const changed = "greenchoice:store-request-key";
const memory = new Map<string, string>();
const storageKey = (scope: string) => `greenchoice.store-request.v1:${scope}`;
const valid = (key: string | null): key is string => Boolean(key && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key));
function snapshot(scope: string) {
  if (typeof window === "undefined") return "";
  try {
    const saved = sessionStorage.getItem(storageKey(scope));
    if (valid(saved)) return saved;
  } catch { /* The mounted browser store survives unavailable session storage. */ }
  return memory.get(scope) || "";
}
function subscribe(notify: () => void) {
  window.addEventListener(changed, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(changed, notify);
    window.removeEventListener("storage", notify);
  };
}
export function clearStoreRequestKey(scope: string) {
  memory.delete(scope);
  try { sessionStorage.removeItem(storageKey(scope)); } catch { /* Optional persistence. */ }
  window.dispatchEvent(new Event(changed));
}
export function useStoreRequestKey(scope: string, enabled: boolean) {
  const key = useSyncExternalStore(subscribe, () => enabled ? snapshot(scope) : "", () => "");
  useEffect(() => {
    if (!enabled || snapshot(scope)) return;
    const next = crypto.randomUUID();
    memory.set(scope, next);
    try { sessionStorage.setItem(storageKey(scope), next); } catch { /* Optional persistence. */ }
    window.dispatchEvent(new Event(changed));
  }, [scope, enabled]);
  return key;
}
