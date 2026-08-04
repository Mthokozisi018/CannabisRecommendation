"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { startNavigationLoading } from "@/components/navigation-loading-events";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function clearInviteHash() {
  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", cleanUrl);
}

function GreenChoiceLogo() {
  return (
    <div className="text-center">
      <div className="mx-auto grid size-24 place-items-center rounded-full border-2 border-[#a7ff18] text-[#a7ff18] shadow-[0_0_34px_rgba(166,255,24,0.24)]">
        <svg viewBox="0 0 96 96" className="size-16" aria-label="GreenChoice">
          <path d="M48 12c8 16 8 30 0 41-8-11-8-25 0-41Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          <path d="M21 28c17 3 28 11 33 25-16 2-28-8-33-25Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          <path d="M75 28c-17 3-28 11-33 25 16 2 28-8 33-25Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          <path d="M22 58c13-7 25-6 36 3-12 8-25 6-36-3Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          <path d="M74 58c-13-7-25-6-36 3 12 8 25 6 36-3Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          <path d="M48 50v31" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
        </svg>
      </div>
      <p className="mt-5 text-2xl font-black uppercase tracking-[0.08em] text-white">
        <span className="text-[#a7ff18]">Green</span>Choice
      </p>
    </div>
  );
}

function PasswordInput({ label, value, onChange, visible, onToggle }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="block text-left text-sm font-bold text-white/90">
      {label}
      <span className="mt-2 flex h-14 items-center gap-3 rounded-xl border border-white/18 bg-black/40 px-4 focus-within:border-[#a7ff18]/75">
        <LockKeyhole size={20} className="shrink-0 text-[#a7ff18]" />
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          className="min-w-0 flex-1 bg-transparent text-base text-white outline-none"
          required
          maxLength={256}
        />
        <button type="button" onClick={onToggle} className="grid size-10 shrink-0 place-items-center text-white/70" aria-label={visible ? "Hide password" : "Show password"}>
          {visible ? <EyeOff size={21} /> : <Eye size={21} />}
        </button>
      </span>
    </label>
  );
}

function InvitationPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invitationId, setInvitationId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("Verifying your invitation...");
  const [status, setStatus] = useState<"loading" | "ready" | "submitting" | "error">("loading");
  const [isReady, setIsReady] = useState(false);
  const verifiedInvitationRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const currentInvitationId = searchParams.get("invitation_id") ?? "";
    const verificationKey = `${currentInvitationId}:${searchParams.get("code") ?? window.location.hash}`;
    if (verifiedInvitationRef.current === verificationKey) return;
    verifiedInvitationRef.current = verificationKey;
    let isMounted = true;

    async function verifyInvitationSession() {
      const supabase = createSupabaseBrowserClient();
      try {
        const code = searchParams.get("code");
        if (!currentInvitationId) throw new Error("Invitation link is invalid or expired.");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw new Error("Invitation link is invalid or expired.");
        } else if (window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.slice(1));
          const inviteError = hashParams.get("error_description") ?? hashParams.get("error");
          if (inviteError) throw new Error("Invitation link is invalid or expired.");
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            if (error) throw new Error("Invitation link is invalid or expired.");
            clearInviteHash();
          }
        }

        const response = await fetch(`/api/manager/invitation/status?invitation_id=${encodeURIComponent(currentInvitationId)}`, {
          cache: "no-store"
        });
        const result = await response.json() as { ok?: boolean; email?: string; error?: string };
        if (!response.ok || !result.ok || !result.email) {
          throw new Error(result.error || "Invitation link is invalid or expired.");
        }
        if (!isMounted) return;
        setInvitationId(currentInvitationId);
        setEmail(result.email);
        setMessage("");
        setStatus("ready");
      } catch (error) {
        await supabase.auth.signOut().catch(() => undefined);
        if (!isMounted) return;
        setMessage(error instanceof Error ? error.message : "Invitation link is invalid or expired.");
        setStatus("error");
      }
    }

    void verifyInvitationSession();
    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invitationId) return;
    setStatus("submitting");
    setMessage("");
    try {
      const response = await fetch("/api/manager/invitation/create-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ invitationId, password, confirmPassword })
      });
      const result = await response.json() as { ok?: boolean; message?: string; error?: string; redirectTo?: string };
      if (!response.ok || !result.ok || !result.redirectTo) {
        setMessage(result.error || "Unable to complete manager setup.");
        setStatus(response.status === 401 || response.status === 403 ? "error" : "ready");
        return;
      }
      setMessage(result.message ?? "Manager account password created successfully. Continue to onboarding.");
      startNavigationLoading();
      router.replace(result.redirectTo as never);
      router.refresh();
    } catch {
      setMessage("Manager setup is temporarily unavailable.");
      setStatus("ready");
    }
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#010502] px-5 py-8 text-white sm:px-8">
      <LoadingOverlay active={status === "loading" || status === "submitting"} />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_12%,rgba(155,255,24,0.08),transparent_28%),linear-gradient(180deg,#010502,#020403_58%,#071103)]" />

      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[760px] items-center">
        <div className="w-full rounded-[30px] border border-[#98dd25]/55 bg-[linear-gradient(145deg,rgba(2,8,5,0.96),rgba(0,0,0,0.94)_45%,rgba(3,8,5,0.96))] px-5 py-10 shadow-[0_36px_130px_rgba(0,0,0,0.62),0_0_60px_rgba(137,220,24,0.08)] sm:px-12 sm:py-14">
          <GreenChoiceLogo />
          <div className="mt-8 text-center">
            <h1 className="text-4xl font-black text-white sm:text-5xl">Create your password</h1>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-white/65">
              Complete the verified invitation for {email || "your manager account"}.
            </p>
          </div>

          {message ? (
            <div className={`mx-auto mt-7 rounded-xl border px-5 py-4 text-center ${status === "error" ? "border-red-300/25 bg-red-500/10 text-red-100" : "border-amber-300/25 bg-amber-500/10 text-amber-100"}`}>
              {message}
            </div>
          ) : null}

          {status === "ready" || status === "submitting" ? (
            <form method="post" onSubmit={submit} className="mt-8 grid gap-5">
              <PasswordInput label="New password" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
              <PasswordInput label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />

              <div className="flex gap-3 rounded-xl border border-[#a7ff18]/18 bg-[#9cff10]/8 p-4 text-sm leading-6 text-white/68">
                <ShieldCheck size={24} className="mt-0.5 shrink-0 text-[#a7ff18]" />
                Use at least 12 characters with uppercase, lowercase, number, and symbol characters.
              </div>

              <button
                type="submit"
                disabled={!isReady || status === "submitting"}
                className="inline-flex min-h-16 items-center justify-center gap-4 rounded-xl bg-[linear-gradient(135deg,#c6ff13,#73d51d)] px-6 text-xl font-black text-black shadow-[0_20px_60px_rgba(157,255,24,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {!isReady ? "Preparing..." : "Complete invitation"}
                <ArrowRight size={24} />
              </button>
            </form>
          ) : null}

          <p className="mt-9 flex items-center justify-center gap-3 text-center text-sm text-white/44">
            <LockKeyhole size={17} />
            If you did not expect this invitation, you can safely ignore the email.
          </p>
        </div>
      </section>
    </main>
  );
}

export function ManagerInvitationPasswordForm() {
  return (
    <Suspense fallback={<LoadingOverlay />}>
      <InvitationPasswordContent />
    </Suspense>
  );
}
