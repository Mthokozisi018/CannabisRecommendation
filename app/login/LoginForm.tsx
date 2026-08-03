"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn, LockKeyhole, Mail } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { LoadingOverlay } from "@/components/LoadingOverlay";

function fieldErrorFromSearch(error: string | null) {
  if (error === "staff") return "No staff profile found. Contact your administrator.";
  if (error === "inactive") return "Your account is inactive. Please contact your manager.";
  if (error === "unauthorized") return "You are not authorized to access that dashboard.";
  if (error === "unavailable") return "GreenChoice authentication is not reachable. Check the Supabase configuration.";
  if (error === "session-expired") return "Your session expired because of inactivity. Please sign in again.";
  if (error) return "Invalid email or password.";
  return "";
}

function LoginField({ label, icon, name, placeholder, type = "text", value, onChange, trailing }: {
  label: string;
  icon: ReactNode;
  name: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="gc-login-field block text-sm font-semibold text-white/95">
      {label}
      <span className="gc-login-input-shell mt-2 flex h-14 items-center gap-4 rounded-xl border border-white/22 bg-[#111719]/70 px-5 text-white/48 shadow-[inset_0_0_0_1px_rgba(130,170,142,0.08)] transition focus-within:border-[#72d654]/75 focus-within:bg-[#12191b]/90">
        <span className="text-[#72d654]">{icon}</span>
        <input name={name} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/42" />
        {trailing}
      </span>
    </label>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(fieldErrorFromSearch(searchParams.get("error")));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlightRef = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlightRef.current) return;
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail || !password) {
      setMessage("Email and password are required.");
      return;
    }

    submissionInFlightRef.current = true;
    setIsSubmitting(true);
    setMessage("");

    try {
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password })
      });
      const loginResult = await loginResponse.json() as { error?: string; redirectTo?: string };
      if (!loginResponse.ok) {
        setMessage(loginResult.error ?? "Invalid email or password.");
        if (loginResult.redirectTo) router.replace(loginResult.redirectTo as never);
        submissionInFlightRef.current = false;
        setIsSubmitting(false);
        return;
      }

      window.location.replace(loginResult.redirectTo ?? "/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "GreenChoice authentication is not reachable. Check the Supabase configuration.");
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <LoadingOverlay active={isSubmitting} />
      <form onSubmit={handleSubmit} className="gc-login-form mt-9 grid gap-6">
        {message ? <p className="rounded-xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-center text-sm text-red-100">{message}</p> : null}
        <LoginField name="email" label="Email Address" icon={<Mail size={24} strokeWidth={2.2} />} placeholder="Enter your work email" type="email" value={email} onChange={setEmail} />
        <LoginField
          name="password"
          label="Password"
          icon={<LockKeyhole size={24} strokeWidth={2.2} />}
          placeholder="Enter your password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={setPassword}
          trailing={
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="grid size-9 place-items-center rounded-full text-white/72 transition hover:bg-white/8 hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff size={24} strokeWidth={2.1} /> : <Eye size={24} strokeWidth={2.1} />}
            </button>
          }
        />
        <button type="submit" disabled={isSubmitting} className="mt-3 inline-flex h-14 items-center justify-center gap-4 rounded-xl bg-[linear-gradient(135deg,#78d95b,#55a93e)] text-xl font-extrabold text-white shadow-[0_18px_42px_rgba(89,188,65,0.28),inset_0_1px_0_rgba(255,255,255,0.24)] transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70">
          <LogIn size={26} strokeWidth={2.2} />
          {isSubmitting ? "Signing In..." : "Sign In"}
        </button>
      </form>
    </>
  );
}
