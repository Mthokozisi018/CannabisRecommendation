"use client";

import Link from "next/link";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { startNavigationLoading } from "@/components/navigation-loading-events";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function passwordErrors(password: string) {
  const errors: string[] = [];
  if (password.length < 8) errors.push("Use at least 8 characters.");
  if (!/[A-Z]/.test(password)) errors.push("Include at least one uppercase letter.");
  if (!/[a-z]/.test(password)) errors.push("Include at least one lowercase letter.");
  if (!/[0-9]/.test(password)) errors.push("Include at least one number.");
  return errors;
}

function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparingSession, setIsPreparingSession] = useState(false);
  const exchangedCodeRef = useRef<string | null>(null);
  const exchangePromiseRef = useRef<Promise<boolean> | null>(null);
  const submissionInFlightRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code || exchangedCodeRef.current === code) return;
    exchangedCodeRef.current = code;
    setIsPreparingSession(true);
    const supabase = createSupabaseBrowserClient();
    exchangePromiseRef.current = supabase.auth.exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          setErrors(["Password reset session is invalid or expired. Request a new reset link."]);
          return false;
        }
        return true;
      })
      .catch(() => {
        setErrors(["Password reset session is invalid or expired. Request a new reset link."]);
        return false;
      })
      .finally(() => setIsPreparingSession(false));
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlightRef.current) return;
    const validationErrors = passwordErrors(password);
    if (password !== confirmPassword) validationErrors.push("Passwords must match.");
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }

    submissionInFlightRef.current = true;
    setIsSubmitting(true);
    setErrors([]);
    try {
      const exchangeOk = await (exchangePromiseRef.current ?? Promise.resolve(true));
      if (!exchangeOk) {
        submissionInFlightRef.current = false;
        setIsSubmitting(false);
        return;
      }
      const updateResponse = await fetch("/api/auth/password-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword })
      });
      const updateResult = await updateResponse.json() as { updated?: boolean; restricted?: boolean; message?: string; redirectTo?: string; error?: string };
      if (!updateResponse.ok || !updateResult.updated) {
        setErrors([updateResult.error ?? "Password reset session is invalid or expired. Request a new reset link."]);
        submissionInFlightRef.current = false;
        setIsSubmitting(false);
        return;
      }
      setMessage(updateResult.message ?? "Password updated successfully. Please log in again.");
      setTimeout(() => {
        startNavigationLoading();
        router.replace((updateResult.redirectTo ?? "/login") as never);
      }, updateResult.restricted ? 1800 : 1500);
    } catch {
      setErrors(["Password reset session is invalid or expired. Request a new reset link."]);
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <LoadingOverlay active={isSubmitting} />
      <form onSubmit={handleSubmit} className="mt-9 grid gap-6">
        {message ? <p className="rounded-xl border border-lime-300/25 bg-lime-500/10 px-5 py-4 text-lime-50">{message}</p> : null}
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
        <button disabled={isSubmitting || isPreparingSession || Boolean(message)} className="h-14 rounded-xl bg-lime-500 font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70">
          {isPreparingSession ? "Preparing..." : isSubmitting ? "Updating..." : "Update password"}
        </button>
      </form>
    </>
  );
}

export default function UpdatePasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#060b0b] px-5 py-10 text-white">
      <section className="w-full max-w-xl rounded-[30px] border border-white/22 bg-[linear-gradient(145deg,rgba(32,42,39,0.84),rgba(7,12,13,0.94))] p-8 shadow-[0_42px_120px_rgba(0,0,0,0.62)] sm:p-10">
        <h1 className="text-4xl font-extrabold">Update password</h1>
        <p className="mt-4 text-lg leading-8 text-white/68">Choose a new password for your staff account.</p>
        <Suspense fallback={<LoadingOverlay />}>
          <UpdatePasswordForm />
        </Suspense>
        <Link href="/login" className="mt-7 inline-flex text-sm font-semibold text-lime-300 hover:text-lime-200">Back to login</Link>
      </section>
    </main>
  );
}
