"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";

export default function ForgotCustomerAccountPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/customer-recover-account", { method: "POST", cache: "no-store", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber: form.get("phoneNumber"), southAfricanId: form.get("southAfricanId") }) });
    const result = await response.json() as { error?: string; message?: string };
    setMessage(result.message ?? result.error ?? "Recovery could not be started.");
    setBusy(false);
  }
  return <main className="grid min-h-screen place-items-center bg-[#06100b] px-5 py-8 text-white"><section className="w-full max-w-lg rounded-3xl border-2 border-white/20 bg-[#101a15] p-7 shadow-2xl"><Link href="/login" className="inline-flex items-center gap-2 font-bold text-emerald-300"><ArrowLeft size={18} /> Back to sign in</Link><KeyRound className="mt-7 text-emerald-300" size={48} /><h1 className="mt-4 text-3xl font-black">Forgot account details?</h1><p className="mt-2 text-white/65">Confirm the phone number and South African ID used during customer registration. GreenChoice will send a secure reset link to the registered email.</p>{message ? <p className="mt-5 rounded-xl border-2 border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-semibold">{message}</p> : null}<form onSubmit={submit} className="mt-6 grid gap-4"><label className="font-bold">Phone number<input name="phoneNumber" type="tel" className="mt-2 h-12 w-full rounded-xl border-2 border-white/20 bg-black/30 px-4 outline-none focus:border-emerald-400" required /></label><label className="font-bold">South African ID number<input name="southAfricanId" inputMode="numeric" maxLength={13} pattern="[0-9]{13}" className="mt-2 h-12 w-full rounded-xl border-2 border-white/20 bg-black/30 px-4 outline-none focus:border-emerald-400" required /></label><button disabled={busy} className="mt-2 h-13 rounded-xl bg-emerald-500 px-5 py-3 font-black text-[#031109] disabled:opacity-60">{busy ? "Checking..." : "Recover Customer Account"}</button></form></section></main>;
}

