"use client";
/* eslint-disable @next/next/no-img-element -- Locally generated QR data URLs have no remote image source to optimise. */
import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QrCode } from "lucide-react";
type StoreQR = { storeName: string; link: string; image: string };
export function StoreRegistrationQR({ buttonClassName, downloadLabel = "Download Poster", printLabel = "Print Poster" }: { buttonClassName?: string; downloadLabel?: string; printLabel?: string }) {
  const instanceId = useId();
  const titleId = `${instanceId}-store-qr-title`;
  const linkId = `${instanceId}-store-qr-link`;
  const dialog = useRef<HTMLDialogElement>(null);
  const [qr, setQR] = useState<StoreQR | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const requestSequence = useRef(0);
  const buttonClass = "min-h-11 rounded-lg border border-[#c4cec6] bg-white px-4 py-2 font-semibold text-[#087c39]";
  const filename = qr ? `GreenChoice-${Array.from(qr.storeName, char => char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? "-" : char).join("").trim()}-Registration-QR.png` : "";
  async function open() {
    if (dialog.current?.open) return;
    dialog.current?.showModal();
    const requestId = ++requestSequence.current;
    setLoading(true); setImageReady(false); setQR(null); setMessage("");
    try {
      const response = await fetch("/api/dashboard/registration-qr", { cache: "no-store" });
      const data = await response.json();
      if (requestId !== requestSequence.current) return;
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to generate QR. Please retry.");
      const url = new URL(data.link);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || !/^\/register\/[a-f0-9]{64}$/.test(url.pathname) || typeof data.storeName !== "string" || !data.storeName.trim() || typeof data.image !== "string" || !data.image.startsWith("data:image/png;base64,")) throw new Error("Unable to generate QR: the store registration link or image is missing.");
      setQR(data);
    } catch (error) {
      if (requestId !== requestSequence.current) return;
      setQR(null); setMessage(error instanceof Error && !error.message.startsWith("Unexpected") ? error.message : "Unable to generate QR. Please retry or sign in again.");
    }
    finally { if (requestId === requestSequence.current) setLoading(false); }
  }
  function close() { requestSequence.current++; dialog.current?.close(); setLoading(false); setImageReady(false); setQR(null); }
  async function copy() {
    if (!qr) return;
    try { await navigator.clipboard.writeText(qr.link); setMessage("Registration link copied."); }
    catch { setMessage("Copy is unavailable. Select and copy the registration link below."); }
  }
  async function share() {
    if (!qr) return;
    try {
      if (navigator.share) {
        const blob = await (await fetch(qr.image)).blob();
        const file = new File([blob], filename, { type: "image/png" });
        await navigator.share({ title: `Register with ${qr.storeName}`, text: `Scan to register as a customer of ${qr.storeName}`, url: qr.link, ...(navigator.canShare?.({ files: [file] }) ? { files: [file] } : {}) });
      } else await copy();
    } catch { setMessage("Sharing did not complete. You can download the QR or copy the link."); }
  }
  return <><button type="button" onClick={open} className={buttonClassName ?? "flex min-h-11 items-center gap-2 rounded-xl border border-[#78b552] bg-[#102016] px-4 py-2 font-bold text-white"}><QrCode aria-hidden size={20} />QR Code</button>
    <dialog ref={dialog} onCancel={close} aria-labelledby={titleId} className="gc-store-qr-dialog max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl bg-white p-5 text-[#14251b] backdrop:bg-black/70">
      <div className="gc-qr-screen-only flex items-center justify-between gap-3"><h2 id={titleId} className="text-xl font-black">Store Registration QR</h2><button className={buttonClass} type="button" onClick={close}>Close</button></div>
      {loading ? <p role="status" className="mt-5">Loading store…</p> : qr && <>
        <h3 className="mt-4 break-words text-center text-lg font-bold">{qr.storeName}</h3>
        <img onLoad={() => setImageReady(true)} onError={() => { setImageReady(false); setQR(null); setMessage("Unable to display the registration poster. Please retry."); }} src={qr.image} alt={`GreenChoice registration poster with QR code for ${qr.storeName}`} width={1024} height={1536} className="gc-qr-poster" />
        <p role="status" className="mt-3 text-center text-sm">{imageReady ? "Poster ready" : "Loading poster…"}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" disabled={!imageReady} onClick={() => {
            if (!imageReady) return;
            const anchor = document.createElement("a"); anchor.href = qr.image; anchor.download = filename; anchor.click();
          }} className={`${buttonClass} disabled:opacity-50`}>{downloadLabel}</button>
          <button type="button" onClick={() => window.print()} disabled={!imageReady} className={`${buttonClass} disabled:opacity-50`}>{printLabel}</button>
          <button type="button" onClick={share} disabled={!imageReady} className={buttonClass}>Share QR</button>
          <button type="button" onClick={copy} className={buttonClass}>Copy Registration Link</button>
        </div>
        <label className="mt-4 block text-sm font-semibold" htmlFor={linkId}>Registration Link</label><input id={linkId} readOnly value={qr.link} className="mt-2 min-h-11 w-full rounded-lg border border-[#c4cec6] p-2 text-sm" onFocus={event => event.currentTarget.select()} />
      </>}
      <p role="status" className="gc-qr-screen-only mt-3 text-sm">{message}</p>
      {!loading && !qr && message && <button type="button" className={`${buttonClass} mt-3`} onClick={() => { close(); void open(); }}>Retry</button>}
    </dialog>
    {qr && imageReady && createPortal(<div className="gc-qr-print-poster" aria-hidden="true"><img src={qr.image} alt="" width={1024} height={1536} /></div>, document.body)}
  </>;
}
