"use client";

import { useId, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { StoreRegistrationQR } from "@/components/manager/StoreRegistrationQR";
import { RegistrationForm } from "@/components/registration/RegistrationForm";

type RegistrationStore = { name: string; token: string };
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#16c78c]/70 bg-[#063b2d] px-3 py-2 text-sm font-black text-[#d7fff0] transition hover:border-[#56f0ba] hover:bg-[#08523e]";

export function StaffCustomerOnboarding({ onRegistered }: { onRegistered?: (phoneNumber: string) => void }) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const sequence = useRef(0);
  const [store, setStore] = useState<RegistrationStore | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadStore() {
    const requestId = ++sequence.current;
    setLoading(true); setError(""); setStore(null); setNotice("");
    try {
      const response = await fetch("/api/dashboard/registration-qr", { cache: "no-store" });
      const data = await response.json();
      if (requestId !== sequence.current) return;
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to load store registration. Please retry.");
      const url = new URL(data.link);
      const match = /^\/register\/([a-f0-9]{64})$/.exec(url.pathname);
      if (!match || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || typeof data.storeName !== "string" || !data.storeName.trim()) {
        throw new Error("The store registration link is unavailable. Please retry.");
      }
      setStore({ name: data.storeName, token: match[1] });
    } catch (cause) {
      if (requestId === sequence.current) setError(cause instanceof Error && !cause.message.startsWith("Unexpected") ? cause.message : "Unable to load store registration. Please retry.");
    } finally { if (requestId === sequence.current) setLoading(false); }
  }
  function open() {
    if (dialog.current?.open) return;
    dialog.current?.showModal();
    void loadStore();
  }
  function clearDialog() {
    sequence.current++; dialog.current?.close(); setStore(null); setLoading(false); setError("");
  }
  function close() { if (!busy) clearDialog(); }

  return <>
    <button type="button" onClick={open} className={buttonClass}><UserPlus aria-hidden size={18} />Register Customer</button>
    <StoreRegistrationQR buttonClassName={buttonClass} downloadLabel="Download QR Code" printLabel="Print QR Code" />
    {notice && <p role="status" className="basis-full text-sm font-semibold text-[#79f2c1]">{notice}</p>}
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { if (busy) event.preventDefault(); else close(); }} className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-[#f1f5f0] p-0 text-[#14251b] backdrop:bg-black/70" data-sentry-block>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#c4cec6] bg-white p-4">
        <h2 id={titleId} className="text-lg font-black">Register Customer</h2>
        <button type="button" onClick={close} disabled={busy} className="min-h-11 rounded-lg border border-[#c4cec6] px-4 py-2 font-semibold text-[#087c39] disabled:opacity-50">Close Registration</button>
      </div>
      {loading && <p role="status" className="p-5">Loading store registration…</p>}
      {error && <div className="p-5"><p role="alert">{error}</p><button type="button" onClick={() => void loadStore()} className="mt-4 min-h-11 rounded-lg border border-[#087c39] px-4 py-2 font-semibold text-[#087c39]">Retry</button></div>}
      {store && <>
        <p className="px-5 pt-4 text-sm leading-6">Assist the customer with their details and document photo. The customer must review and accept the agreements.</p>
        <RegistrationForm embedded token={store.token} storeName={store.name} onBusyChange={setBusy} onRegistered={phoneNumber => {
          clearDialog(); setNotice("Registration successful. Search the customer's cellphone number to link them to the sale."); onRegistered?.(phoneNumber);
        }} />
      </>}
    </dialog>
  </>;
}
