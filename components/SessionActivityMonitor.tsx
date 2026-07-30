"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ActivityMessage = {
  type?: "activity" | "signed-out";
  lastActivityAt?: number;
};

const inactivityTimeoutMs = 20 * 60_000;
const warningLeadMs = 2 * 60_000;
const activityStorageKey = "greenchoice:last-genuine-activity";

export function SessionActivityMonitor() {
  const router = useRouter();
  const pathname = usePathname();
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);
  const lastActivityAtRef = useRef(0);
  const signingOutRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);

  const expire = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    channelRef.current?.postMessage({ type: "signed-out" } satisfies ActivityMessage);
    window.localStorage.removeItem(activityStorageKey);
    try {
      const supabase = supabaseRef.current ?? createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // The server still validates Supabase Auth on every protected request.
    }
    router.replace("/login?error=session-expired" as never);
    router.refresh();
  }, [router]);

  const applyActivity = useCallback((lastActivityAt: number, broadcast: boolean) => {
    lastActivityAtRef.current = lastActivityAt;
    window.localStorage.setItem(activityStorageKey, String(lastActivityAt));
    setRemainingMinutes(null);
    if (broadcast) {
      channelRef.current?.postMessage({
        type: "activity",
        lastActivityAt
      } satisfies ActivityMessage);
    }
  }, []);

  const recordActivity = useCallback(() => {
    applyActivity(Date.now(), true);
  }, [applyActivity]);

  const checkExpiry = useCallback(() => {
    const remaining = lastActivityAtRef.current + inactivityTimeoutMs - Date.now();
    if (remaining <= 0) {
      void expire();
      return;
    }
    setRemainingMinutes(remaining <= warningLeadMs
      ? Math.max(1, Math.ceil(remaining / 60_000))
      : null);
  }, [expire]);

  useEffect(() => {
    if (pathname.startsWith("/dashboard/restricted")) return;

    const supabase = createSupabaseBrowserClient();
    supabaseRef.current = supabase;
    const initialActivityAt = Date.now();
    lastActivityAtRef.current = initialActivityAt;
    window.localStorage.setItem(activityStorageKey, String(initialActivityAt));

    const channel = new BroadcastChannel("greenchoice-session");
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<ActivityMessage>) => {
      if (event.data?.type === "signed-out") {
        void expire();
      } else if (
        event.data?.type === "activity" &&
        typeof event.data.lastActivityAt === "number" &&
        event.data.lastActivityAt > lastActivityAtRef.current
      ) {
        applyActivity(event.data.lastActivityAt, false);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) void expire();
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) void expire();
    });

    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    const warningTimer = window.setInterval(checkExpiry, 10_000);
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") checkExpiry();
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      document.removeEventListener("visibilitychange", visibilityHandler);
      window.clearInterval(warningTimer);
      authListener.subscription.unsubscribe();
      channel.close();
      channelRef.current = null;
      supabaseRef.current = null;
    };
  }, [applyActivity, checkExpiry, expire, pathname, recordActivity]);

  async function continueSession() {
    recordActivity();
    try {
      const supabase = supabaseRef.current ?? createSupabaseBrowserClient();
      const { data } = await supabase.auth.refreshSession();
      if (!data.session) await expire();
    } catch {
      await expire();
    }
  }

  if (pathname.startsWith("/dashboard/restricted") || !remainingMinutes) return null;
  return (
    <div role="alertdialog" aria-live="assertive" className="fixed bottom-5 right-5 z-[200] w-[min(92vw,360px)] rounded-lg border border-amber-300/55 bg-[#07100d] p-4 text-white shadow-2xl">
      <p className="font-extrabold">Session expiring soon</p>
      <p className="mt-1 text-sm text-white/78">
        You will be signed out after {remainingMinutes} minute{remainingMinutes === 1 ? "" : "s"} of inactivity.
      </p>
      <button type="button" onClick={() => void continueSession()} className="mt-3 h-10 w-full rounded-md bg-lime-500 font-extrabold text-black">
        Continue session
      </button>
    </div>
  );
}
