"use client";

import Link from "next/link";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { managerPasswordIssues } from "@/lib/manager/password-policy";
import { createSupabaseBrowserClient, createSupabaseImplicitRecoveryClient } from "@/lib/supabase/client";

function clearRecoveryParameters() {
  window.history.replaceState(null, "", window.location.pathname);
}

function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparingSession, setIsPreparingSession] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const submissionInFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    let recoverySessionReceived = false;
    let initializationSucceeded = false;
    let expiryTimer: number | undefined;
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const hasRecoveryLink = Boolean(code || (tokenHash && url.searchParams.get("type") === "recovery") ||
      (accessToken && refreshToken && hash.get("type") === "recovery"));
    const expire = () => {
      if (!active) return;
      clearRecoveryParameters();
      setIsExpired(true);
      setIsPreparingSession(false);
    };
    const ready = () => {
      if (!active) return;
      window.clearTimeout(expiryTimer);
      clearRecoveryParameters();
      setIsReady(true);
      setIsPreparingSession(false);
    };
    if (!hasRecoveryLink || url.searchParams.has("error") || hash.has("error")) {
      expire();
      return () => { active = false; };
    }

    if (accessToken && refreshToken) {
      let implicit: ReturnType<typeof createSupabaseImplicitRecoveryClient>;
      try {
        implicit = createSupabaseImplicitRecoveryClient();
      } catch {
        expire();
        return () => { active = false; };
      }
      let recoverySession: { access_token: string; refresh_token: string } | null = null;
      const { data: { subscription } } = implicit.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" && session) recoverySession = session;
      });
      void (async () => {
        const { error } = await implicit.auth.initialize();
        if (!active) return;
        if (error) { expire(); return; }
        const session = recoverySession ?? (await implicit.auth.getSession()).data.session;
        if (!session) { expire(); return; }
        // The SSR client always uses PKCE and rejects an implicit URL fragment.
        // Remove it before transferring the Auth-verified recovery session to cookies.
        clearRecoveryParameters();
        const supabase = createSupabaseBrowserClient();
        const transferred = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token
        });
        if (transferred.error || !transferred.data.session) expire();
        else ready();
      })().catch(expire);
      return () => { active = false; subscription.unsubscribe(); };
    }

    // The SSR browser client consumes PKCE codes during initialization.
    // Exchanging the same code here would consume it twice.
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      expire();
      return () => { active = false; };
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "PASSWORD_RECOVERY" || !session || !active) return;
      recoverySessionReceived = true;
      if (initializationSucceeded) ready();
    });

    void (async () => {
      const { error } = await supabase.auth.initialize();
      if (!active) return;
      if (error) { expire(); return; }
      initializationSucceeded = true;
      if (tokenHash) {
        if (url.searchParams.get("type") !== "recovery") { expire(); return; }
        const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        if (result.error || !result.data.session) expire();
        else ready();
        return;
      }
      if (recoverySessionReceived) ready();
      else expiryTimer = window.setTimeout(expire, 5000);
    })().catch(expire);
    return () => { active = false; window.clearTimeout(expiryTimer); subscription.unsubscribe(); };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlightRef.current) return;
    const validationErrors = managerPasswordIssues(password, confirmPassword);
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }

    submissionInFlightRef.current = true;
    setIsSubmitting(true);
    setErrors([]);
    try {
      if (!isReady) {
        submissionInFlightRef.current = false;
        setIsSubmitting(false);
        return;
      }
      const updateResponse = await fetch("/api/auth/password-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword })
      });
      const updateResult = await updateResponse.json() as { updated?: boolean; error?: string };
      if (!updateResponse.ok || !updateResult.updated) {
        setErrors([updateResult.error ?? "Password reset session is invalid or expired. Request a new reset link."]);
        submissionInFlightRef.current = false;
        setIsSubmitting(false);
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setIsSubmitting(false);
      setIsSuccess(true);
    } catch {
      setErrors(["Password reset session is invalid or expired. Request a new reset link."]);
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <LoadingOverlay active={isSubmitting} />
      {isSuccess ? <div className="mt-9 rounded-xl border border-lime-300/25 bg-lime-500/10 px-5 py-5 text-lime-50"><h2 className="text-2xl font-bold">Password Reset Successful</h2><p className="mt-2">Your password has been updated successfully. You can now sign in using your new password.</p><Link href="/login" className="mt-5 inline-flex rounded-xl bg-lime-500 px-5 py-3 font-bold text-black">Back to Login</Link></div> : null}
      {isExpired ? <div className="mt-9 rounded-xl border border-red-300/25 bg-red-500/10 px-5 py-5 text-red-100"><h2 className="text-2xl font-bold">Password Reset Link Expired</h2><p className="mt-2">This password reset link is no longer valid. Please request a new password reset email.</p><Link href="/forgot-password" className="mt-5 inline-flex rounded-xl bg-lime-500 px-5 py-3 font-bold text-black">Request New Reset Link</Link></div> : null}
      {!isSuccess && !isExpired ? (
      <form method="post" onSubmit={handleSubmit} className="mt-9 grid gap-6">
        {isPreparingSession ? <p className="rounded-xl border border-lime-300/25 bg-lime-500/10 px-5 py-4 text-lime-50">Preparing your secure reset session...</p> : null}
        {errors.length ? <div className="rounded-xl border border-red-300/25 bg-red-500/10 px-5 py-4 text-red-100">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
        <label className="block text-base font-semibold text-white/95">
          New Password
          <span className="mt-3 flex h-16 items-center gap-4 rounded-xl border border-white/22 bg-[#111719]/70 px-5 text-white/48 focus-within:border-[#72d654]/75">
            <LockKeyhole className="text-[#72d654]" size={25} />
            <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} className="min-w-0 flex-1 bg-transparent text-lg text-white outline-none placeholder:text-white/42" placeholder="Enter new password" />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="grid size-9 place-items-center rounded-full text-white/72 hover:bg-white/8 hover:text-white">
              {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
            </button>
          </span>
        </label>
        <label className="block text-base font-semibold text-white/95">
          Confirm Password
          <span className="mt-3 flex h-16 items-center gap-4 rounded-xl border border-white/22 bg-[#111719]/70 px-5 text-white/48 focus-within:border-[#72d654]/75">
            <LockKeyhole className="text-[#72d654]" size={25} />
            <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type={showPassword ? "text" : "password"} className="min-w-0 flex-1 bg-transparent text-lg text-white outline-none placeholder:text-white/42" placeholder="Confirm new password" />
          </span>
        </label>
        <button disabled={!isReady || isSubmitting || isPreparingSession} className="h-14 rounded-xl bg-lime-500 font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70">
          {!isReady || isPreparingSession ? "Preparing..." : isSubmitting ? "Resetting..." : "Reset password"}
        </button>
      </form>
      ) : null}
    </>
  );
}

export default function UpdatePasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#060b0b] px-5 py-10 text-white">
      <section className="w-full max-w-xl rounded-[30px] border border-white/22 bg-[linear-gradient(145deg,rgba(32,42,39,0.84),rgba(7,12,13,0.94))] p-8 shadow-[0_42px_120px_rgba(0,0,0,0.62)] sm:p-10">
        <h1 className="text-4xl font-extrabold">Reset password</h1>
        <p className="mt-4 text-lg leading-8 text-white/68">Choose a replacement password for your existing GreenChoice account.</p>
        <UpdatePasswordForm />
        <Link href="/login" className="mt-7 inline-flex text-sm font-semibold text-lime-300 hover:text-lime-200">Back to login</Link>
      </section>
    </main>
  );
}
