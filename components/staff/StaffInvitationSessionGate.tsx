"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function cleanOnboardingUrl(invitationId: string) {
  return `/staff/invitation/onboarding?invitation_id=${encodeURIComponent(invitationId)}`;
}

export function StaffInvitationSessionGate({ invitationId }: { invitationId: string }) {
  const [message, setMessage] = useState("Preparing your receptionist onboarding...");
  const [isError, setIsError] = useState(false);
  const preparedInvitationRef = useRef<string | null>(null);

  useEffect(() => {
    if (preparedInvitationRef.current === invitationId) return;
    preparedInvitationRef.current = invitationId;
    let isMounted = true;

    async function prepareSession() {
      const supabase = createSupabaseBrowserClient();
      try {
        const currentUrl = new URL(window.location.href);
        const code = currentUrl.searchParams.get("code");
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const inviteError = hashParams.get("error_description") ?? hashParams.get("error");
        if (inviteError) throw new Error("Invitation link is invalid or expired.");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw new Error("Invitation link is invalid or expired.");
        } else {
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            if (error) throw new Error("Invitation link is invalid or expired.");
          }
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user?.email) {
          throw new Error("Invitation session was not found. Open the latest link from your invitation email again.");
        }
        if (userData.user.user_metadata?.staff_invitation_id !== invitationId) {
          await supabase.auth.signOut();
          throw new Error("Invitation session was not found. Open the latest link from your invitation email again.");
        }
        if (isMounted) {
          window.location.replace(cleanOnboardingUrl(invitationId));
          return;
        }
      } catch (error) {
        if (!isMounted) return;
        setMessage(error instanceof Error ? error.message : "Invitation link is invalid or expired.");
        setIsError(true);
      }
    }

    prepareSession();
    return () => {
      isMounted = false;
    };
  }, [invitationId]);

  return (
    <div className="mx-auto mt-10 max-w-2xl rounded-lg border border-lime-400/28 bg-[#060b08]/86 p-8 text-center shadow-[0_26px_90px_rgba(0,0,0,0.54)] backdrop-blur-md">
      {!isError ? <Loader2 className="mx-auto animate-spin text-lime-300" size={44} /> : null}
      <h1 className="mt-5 text-3xl font-extrabold">{isError ? "Invitation Session Needed" : "Opening Onboarding"}</h1>
      <p className="mt-4 text-lg leading-8 text-white/78">{message}</p>
      {isError ? (
        <a href="/login" className="mt-7 inline-flex h-12 items-center rounded-md bg-lime-500 px-7 font-extrabold text-black transition hover:brightness-110">
          Return to Login
        </a>
      ) : null}
    </div>
  );
}
