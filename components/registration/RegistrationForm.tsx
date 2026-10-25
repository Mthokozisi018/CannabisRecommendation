"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Legal anchors open a native dialog and retain the mounted form, rather than navigating. */
/* eslint-disable @next/next/no-img-element -- Private local blob previews must not go through an image proxy. */

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { DashboardBackdrop } from "@/components/DashboardBackdrop";
import { CustomerRegistrationArtwork } from "@/components/registration/CustomerRegistrationArtwork";
import { registrationSchema } from "@/lib/registration/validation";
import { MAX_REGISTRATION_SOURCE_BYTES, prepareRegistrationUpload, uploadTooLargeMessage } from "@/lib/registration/client-image";
import { registrationLegalDocuments, REGISTRATION_NOTICE_VERSION, type RegistrationLegalSlug } from "@/lib/registration/legal";
import styles from "./RegistrationForm.module.css";

const inputClass = "mt-2 min-h-12 w-full min-w-0 rounded-xl border border-[#52715b] bg-[#0a1710] px-4 py-3 text-base text-[#eef6f0] shadow-[inset_0_1px_2px_rgba(0,0,0,0.18)] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#9fb3a4] hover:border-[#72967a] focus:border-[#72e79a] focus:ring-2 focus:ring-[#3bad69]/35 aria-[invalid=true]:border-[#ff8f83]";
const actionClass = "min-h-12 rounded-xl border border-[#3d9260] bg-[#11241a] px-4 py-3 font-semibold text-[#a4f7bf] transition-[border-color,background-color,transform] duration-200 hover:border-[#72e79a] hover:bg-[#173e28] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8bf3ad] motion-reduce:transition-none";
const sectionClass = "rounded-2xl border border-[#3b6248] bg-[#101b14]/95 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.18)] sm:p-6";
const legalLinkClass = "font-semibold text-[#8bf3ad] underline decoration-transparent underline-offset-4 transition-colors hover:text-[#c1ffd2] hover:decoration-current focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8bf3ad]";

export function RegistrationForm({ token, storeName, onRegistered, onBusyChange, embedded = false }: { token: string; storeName: string; onRegistered?: (phoneNumber: string) => void; onBusyChange?: (busy: boolean) => void; embedded?: boolean }) {
  const [type, setType] = useState<"sa_id" | "passport">("sa_id");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const [legal, setLegal] = useState<RegistrationLegalSlug>("customer-terms");
  const formRef = useRef<HTMLFormElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const locked = useRef(false);
  const submission = useRef<string | null>(null);
  const preparedImage = useRef<{ source: File; upload: File } | null>(null);
  const legalReturn = useRef<{ top: number; element: HTMLElement | null }>({ top: 0, element: null });

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);
  useEffect(() => {
    // Wait until disabled controls have been re-enabled after a failed request.
    if (busy || !error) return;
    const frame = requestAnimationFrame(() => {
      const element = error.field === "image" ? document.getElementById("image-action")
        : error.field === "channels" ? formRef.current?.querySelector('input[name="channels"]')
        : formRef.current?.elements.namedItem(error.field);
      const target = element instanceof HTMLElement ? element : document.getElementById("registration-error");
      target?.focus(); target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [busy, error]);

  function invalidate() { setError(null); submission.current = null; preparedImage.current = null; }
  function showError(field: string, message: string) {
    setError({ field, message });
  }
  function choose(file?: File) {
    if (!file) return;
    invalidate();
    if (file.size > MAX_REGISTRATION_SOURCE_BYTES || !file.size) { showError("image", "Choose an image no larger than 12 MB."); return; }
    setImage(file);
    setPreview(URL.createObjectURL(file));
  }
  function openLegal(event: React.MouseEvent<HTMLAnchorElement>, slug: RegistrationLegalSlug, anchor?: string) {
    event.preventDefault();
    legalReturn.current = { top: window.scrollY, element: event.currentTarget };
    setLegal(slug);
    dialog.current?.showModal();
    requestAnimationFrame(() => {
      const content = dialog.current?.querySelector<HTMLElement>(".legal-content");
      if (anchor) dialog.current?.querySelector(`#${anchor}`)?.scrollIntoView();
      else content?.scrollTo(0, 0);
      dialog.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    });
  }
  function closeLegal() {
    dialog.current?.close();
    legalReturn.current.element?.focus({ preventScroll: true });
    window.scrollTo(0, legalReturn.current.top);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    const form = new FormData(event.currentTarget);
    submission.current ??= crypto.randomUUID();
    const parsed = registrationSchema.safeParse({
      fullName: form.get("fullName"), email: form.get("email"), phoneNumber: form.get("phoneNumber"),
      documentType: type, documentNumber: form.get("documentNumber"),
      acceptTerms: form.get("acceptTerms") === "on", acceptPrivacy: form.get("acceptPrivacy") === "on",
      acceptVerification: form.get("acceptVerification") === "on", marketing,
      channels: marketing ? form.getAll("channels") : [], submissionId: submission.current
    });
    if (!parsed.success) { const issue = parsed.error.issues[0]; showError(String(issue.path[0] ?? ""), issue.message); return; }
    if (!image) { showError("image", "Take a photo or choose your document image."); return; }
    locked.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    try {
      let upload = preparedImage.current?.source === image ? preparedImage.current.upload : null;
      if (!upload) {
        try { upload = await prepareRegistrationUpload(image); }
        catch { showError("image", uploadTooLargeMessage); return; }
        preparedImage.current = { source: image, upload };
      }
      const body = new FormData();
      body.set("details", JSON.stringify(parsed.data)); body.set("image", upload);
      const response = await fetch(`/api/registration/${token}`, { method: "POST", body });
      if (response.status === 413) { showError("image", uploadTooLargeMessage); return; }
      if (!response.headers.get("content-type")?.includes("application/json")) {
        showError("", "Registration is temporarily unavailable. Your details are still here; please retry safely.");
        return;
      }
      const result = await response.json();
      if (!response.ok) { showError(result.field ?? "", result.error ?? "Registration could not be completed."); return; }
      if (onRegistered) { onRegistered(parsed.data.phoneNumber); return; }
      // Discard the mounted document form after the receipt cookie has been committed.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/register/success");
    } catch { showError("", "We could not complete the request. Your details are still here; please retry safely."); }
    finally { locked.current = false; setBusy(false); onBusyChange?.(false); }
  }
  function fieldError(name: string) { return error?.field === name ? <p id={`${name}-error`} className="mt-2 text-sm font-semibold text-[#ffaaa0]">{error.message}</p> : null; }
  const legalDoc = registrationLegalDocuments[legal];
  return (
    <main className={`${embedded ? "" : "min-h-[100dvh]"} relative isolate bg-[#050909] [color-scheme:dark] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-[#eef6f0]`} data-sentry-block>
      <DashboardBackdrop variant="receptionist" image="/images/backgrounds/registration-sales-wallpaper.png" />
      <div className="mx-auto w-full max-w-xl">
        <h1 className="sr-only">Customer Registration</h1>
        <CustomerRegistrationArtwork />
        <p className="mb-5 break-words text-center text-xl font-bold text-[#eef6f0] sm:text-2xl">{storeName}</p>
        <form ref={formRef} noValidate onSubmit={submit} onChange={event => { if (!(event.target instanceof HTMLInputElement) || event.target.type !== "file") invalidate(); }} className="space-y-5">
          <fieldset disabled={busy} className="min-w-0 space-y-5 disabled:opacity-70">
            <section className={sectionClass} aria-labelledby="details-heading">
              <h2 id="details-heading" className="mb-5 text-xl font-bold">Your Details</h2>
              <div className="space-y-5">
                <div><label htmlFor="fullName" className="font-semibold">Full Name</label><input id="fullName" name="fullName" autoComplete="name" required maxLength={160} className={inputClass} aria-invalid={error?.field === "fullName"} aria-describedby={error?.field === "fullName" ? "fullName-error" : undefined} />{fieldError("fullName")}</div>
                <div><label htmlFor="email" className="font-semibold">Email Address (Required)</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={320} className={inputClass} aria-invalid={error?.field === "email"} aria-describedby={error?.field === "email" ? "email-error" : undefined} />{fieldError("email")}</div>
                <div><label htmlFor="phoneNumber" className="font-semibold">Cellphone Number</label><input id="phoneNumber" name="phoneNumber" type="tel" inputMode="tel" autoComplete="tel" required maxLength={30} placeholder="082 123 4567" className={inputClass} aria-invalid={error?.field === "phoneNumber"} aria-describedby={error?.field === "phoneNumber" ? "phoneNumber-error" : undefined} />{fieldError("phoneNumber")}</div>
                <fieldset><legend className="mb-2 font-semibold">Document Type</legend><div className="grid grid-cols-2 gap-1 rounded-xl border border-[#52715b] bg-[#0a1710] p-1">
                  {(["sa_id", "passport"] as const).map(value => <label key={value} className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg font-bold transition-colors duration-200 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#8bf3ad] ${type === value ? "bg-[#087c39] text-white" : "bg-[#101b14] text-[#eef6f0] hover:bg-[#1b3424]"}`}><input type="radio" name="documentType" value={value} checked={type === value} onChange={() => { setType(value); invalidate(); }} className="size-4 accent-[#22c55e]" />{value === "sa_id" ? "SA ID" : "Passport"}</label>)}
                </div></fieldset>
                <div><label htmlFor="documentNumber" className="font-semibold">{type === "sa_id" ? "SA ID Number" : "Passport Number"}</label><input key={type} id="documentNumber" name="documentNumber" type="text" inputMode={type === "sa_id" ? "numeric" : "text"} required maxLength={type === "sa_id" ? 13 : 20} autoComplete="off" autoCapitalize="characters" spellCheck={false} className={inputClass} aria-invalid={error?.field === "documentNumber"} aria-describedby={`document-help${error?.field === "documentNumber" ? " documentNumber-error" : ""}`} /><p id="document-help" className="mt-2 text-sm text-[#b0c5b6]">{type === "sa_id" ? "Enter all 13 digits exactly as printed on your ID." : "Enter 5–20 letters or digits exactly as printed on your passport."}</p>{fieldError("documentNumber")}</div>
              </div>
            </section>
            <section className={sectionClass} aria-labelledby="verify-heading">
              <h2 id="verify-heading" className="text-xl font-bold">Verify Your Document</h2>
              <p className="mt-2 text-sm leading-6 text-[#b0c5b6]">We check that the document number matches and separately confirm that you are at least 18.</p>
              <h3 className="mb-3 mt-5 font-semibold">ID Document Photo</h3>
              <input ref={camera} type="file" aria-label="Take document photo" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" className="hidden" onChange={event => { choose(event.target.files?.[0]); event.target.value = ""; }} />
              <input ref={gallery} type="file" aria-label="Choose document from gallery" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={event => { choose(event.target.files?.[0]); event.target.value = ""; }} />
              <div className="rounded-2xl border border-dashed border-[#51815d] bg-[#0a1710] p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#16432a] text-[#a4f7bf]"><ImagePlus aria-hidden size={22} /></span><div><p className="font-semibold">Add a clear document image</p><p role="status" className="mt-1 break-all text-sm text-[#b0c5b6]">{image ? `Selected: ${image.name}` : "No photo selected yet"}</p></div></div>
                <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2"><button id="image-action" type="button" onClick={() => camera.current?.click()} className={actionClass} aria-describedby={error?.field === "image" ? "image-error" : undefined}><Camera aria-hidden className="mx-auto mb-1" size={20} />Take Photo</button><button type="button" onClick={() => gallery.current?.click()} className={actionClass}><ImagePlus aria-hidden className="mx-auto mb-1" size={20} />Choose from Gallery</button></div>
              </div>
              {preview && <div className="mt-4"><img src={preview} alt="Preview of your selected identity document" className="max-h-64 w-full rounded-xl border border-[#3e614b] object-contain" /><div className="mt-3 grid grid-cols-2 gap-3"><button type="button" className={actionClass} onClick={() => gallery.current?.click()}>Replace Photo</button><button type="button" className={actionClass} onClick={() => { setImage(null); setPreview(null); invalidate(); }}>Remove Photo</button></div></div>}
              {fieldError("image")}
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm leading-6 text-[#b0c5b6]"><li>Show the complete document.</li><li>Keep the information clear and readable.</li><li>Avoid glare, blur and cropped edges.</li></ul>
              <p className="mt-3 text-sm text-[#b0c5b6]">Maximum 6 MB. JPEG, PNG, WebP or supported HEIC. Your photo is processed privately and deleted after checking.</p>
            </section>
            <section className={sectionClass} aria-labelledby="agreements-heading">
              <h2 id="agreements-heading" className="mb-4 text-xl font-bold">Agreements</h2>
              <div className="space-y-3">{([
                ["acceptTerms", "I agree to the", "Customer Terms & Conditions", "customer-terms"],
                ["acceptPrivacy", "I have read the", "Privacy Notice", "privacy"],
                ["acceptVerification", "I have read the", "ID Verification Notice", "id-verification"]
              ] as const).map(([name, prefix, label, slug]) => <div key={name}>
                <label className={`${styles.agreementRow} ${error?.field === name ? styles.agreementRowError : ""}`}>
                  <input id={name} name={name} type="checkbox" required className={`${styles.checkbox} ${error?.field === name ? styles.checkboxError : ""}`} aria-invalid={error?.field === name} aria-describedby={error?.field === name ? `${name}-error` : undefined} />
                  <span className="min-w-0 leading-6">{prefix} <a href={`/legal/${slug}`} onClick={event => openLegal(event, slug)} className={legalLinkClass}>{label}</a>.</span>
                </label>
                {fieldError(name)}
              </div>)}</div>
              <a href="/legal/privacy#identity-documents" onClick={event => openLegal(event, "privacy", "identity-documents")} className={`mb-4 mt-2 inline-flex min-h-11 items-center text-sm ${legalLinkClass}`}>How your document image is handled</a>
              <div className="border-t border-[#315640] pt-4"><label className={styles.agreementRow}><input type="checkbox" name="marketing" checked={marketing} onChange={event => setMarketing(event.target.checked)} className={styles.checkbox} /><span className="leading-6">Send me promotions from this store (Optional).</span></label>
                {marketing && <fieldset className="mt-3"><legend className="text-sm font-semibold">Choose your channels</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{["email", "sms", "whatsapp"].map(channel => <label key={channel} className={styles.agreementRow}><input name="channels" type="checkbox" value={channel} className={styles.checkbox} aria-describedby={error?.field === "channels" ? "channels-error" : undefined} /><span className="leading-6">{channel === "email" ? "Email" : channel === "sms" ? "SMS" : "WhatsApp"}</span></label>)}</div>{fieldError("channels")}</fieldset>}
                <a href="/legal/marketing" onClick={event => openLegal(event, "marketing")} className={`inline-flex min-h-11 items-center text-sm ${legalLinkClass}`}>Read about marketing choices</a>
              </div>
            </section>
          </fieldset>
          {error && <div id="registration-error" tabIndex={-1} role="alert" className="rounded-xl border border-[#dd7a70] bg-[#321510] p-4 font-semibold text-[#ffb4aa]">{error.message}</div>}
          <p role="status" aria-live="polite" className="text-center text-sm font-semibold">{busy ? "Checking your document…" : ""}</p>
          <button type="submit" disabled={busy} className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#087c39] to-[#0aa351] px-4 py-4 text-lg font-bold text-white shadow-[0_12px_30px_rgba(8,124,57,0.22)] transition-[filter,transform,box-shadow] duration-200 hover:brightness-110 hover:shadow-[0_14px_34px_rgba(8,124,57,0.32)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8bf3ad] disabled:cursor-wait disabled:opacity-55 disabled:shadow-none motion-reduce:transition-none">{busy ? <><LoaderCircle aria-hidden size={21} className="animate-spin motion-reduce:animate-none" />Verifying ID and registering…</> : "Register Customer"}</button>
          <p className="flex items-center justify-center gap-2 text-center text-sm text-[#b0c5b6]"><ShieldCheck aria-hidden size={18} />Your registration belongs to {storeName}.</p>
        </form>
      </div>
      <dialog ref={dialog} onCancel={closeLegal} aria-labelledby="legal-title" className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none bg-[#101b14] p-0 text-[#eef6f0] backdrop:bg-black/60">
        <div className="flex h-full flex-col"><header className="flex items-center justify-between gap-3 border-b border-[#315640] bg-[#101b14] px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]"><button type="button" onClick={closeLegal} className={actionClass}>Back to Registration</button><X aria-hidden /></header>
          <article className="legal-content mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6"><h2 id="legal-title" className="text-2xl font-black">{legalDoc.title}</h2><p className="mt-2 text-sm text-[#b0c5b6]">Version {REGISTRATION_NOTICE_VERSION}</p>{legalDoc.sections.map(section => <section id={section.id} key={section.id} className="mt-6 scroll-mt-6"><h3 className="text-xl font-bold">{section.heading}</h3><p className="mt-3 leading-7">{section.content}</p></section>)}</article>
        </div>
      </dialog>
    </main>
  );
}
