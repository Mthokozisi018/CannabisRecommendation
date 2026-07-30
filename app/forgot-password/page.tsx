"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

const successMessage = "If an account exists for this email, a password reset link has been sent.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlightRef = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlightRef.current) return;
    if (!email.trim()) {
      setMessage("Email is required.");
      return;
    }

    submissionInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      await fetch("/api/auth/password-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
      });
      setMessage(successMessage);
    } catch {
      setMessage(successMessage);
    } finally {
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#060b0b] px-5 py-10 text-white">
      <section className="w-full max-w-xl rounded-[30px] border border-white/22 bg-[linear-gradient(145deg,rgba(32,42,39,0.84),rgba(7,12,13,0.94))] p-8 shadow-[0_42px_120px_rgba(0,0,0,0.62)] sm:p-10">
        <h1 className="text-4xl font-extrabold">Reset password</h1>
        <p className="mt-4 text-lg leading-8 text-white/68">Enter your staff email address.</p>
        <form onSubmit={handleSubmit} className="mt-9 grid gap-6">
          {message ? <p className="rounded-xl border border-lime-300/25 bg-lime-500/10 px-5 py-4 text-lime-50">{message}</p> : null}
          <label className="block text-base font-semibold text-white/95">
            Email Address
            <span className="mt-3 flex h-16 items-center gap-4 rounded-xl border border-white/22 bg-[#111719]/70 px-5 text-white/48 focus-within:border-[#72d654]/75">
              <Mail className="text-[#72d654]" size={25} />
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="min-w-0 flex-1 bg-transparent text-lg text-white outline-none placeholder:text-white/42" placeholder="Enter your work email" />
            </span>
          </label>
          <button disabled={isSubmitting} className="h-14 rounded-xl bg-lime-500 font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70">
            {isSubmitting ? "Sending..." : "Send reset link"}
          </button>
        </form>
        <Link href="/login" className="mt-7 inline-flex text-sm font-semibold text-lime-300 hover:text-lime-200">Back to login</Link>
      </section>
    </main>
  );
}
