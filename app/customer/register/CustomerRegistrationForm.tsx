"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Eye, EyeOff, UserPlus } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { SOUTH_AFRICAN_PROVINCES } from "@/lib/customer/validation";

const inputClass = "mt-2 h-12 w-full rounded-xl border-2 border-[#d9e2dc] bg-white px-4 text-[#102018] outline-none transition placeholder:text-[#839087] focus:border-[#159447]";

function Field({ label, name, type = "text", autoComplete, placeholder, required = true }: { label: string; name: string; type?: string; autoComplete?: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="text-sm font-bold text-[#1b2b22]">
      {label}
      <input className={inputClass} name={name} type={type} autoComplete={autoComplete} placeholder={placeholder} required={required} />
    </label>
  );
}

export function CustomerRegistrationForm() {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      firstName: form.get("firstName"),
      surname: form.get("surname"),
      email: form.get("email"),
      phoneNumber: form.get("phoneNumber"),
      southAfricanId: form.get("southAfricanId"),
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
      streetAddress: form.get("streetAddress"),
      unitDetails: form.get("unitDetails"),
      suburb: form.get("suburb"),
      city: form.get("city"),
      province: form.get("province"),
      postalCode: form.get("postalCode"),
      acceptTerms: form.get("acceptTerms") === "on",
      acceptPrivacy: form.get("acceptPrivacy") === "on",
      acceptPhysicalIdNotice: form.get("acceptPhysicalIdNotice") === "on",
      marketingConsent: form.get("marketingConsent") === "on"
    };

    try {
      const response = await fetch("/api/auth/customer-register", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json() as { error?: string; message?: string; redirectTo?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Check your registration information.");
        return;
      }
      sessionStorage.setItem("greenchoice:customer-registration-message", result.message ?? "Account created.");
      router.replace((result.redirectTo ?? "/customer/verify-email") as never);
    } catch {
      setMessage("Customer registration is temporarily unavailable. Please try again.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <LoadingOverlay active={isSubmitting} />
      <form onSubmit={submit} className="grid gap-7">
        {message ? <p role="alert" className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</p> : null}

        <section>
          <h2 className="text-xl font-black text-[#102018]">Your details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Name" name="firstName" autoComplete="given-name" />
            <Field label="Surname" name="surname" autoComplete="family-name" />
            <Field label="Email address" name="email" type="email" autoComplete="email" />
            <Field label="Phone number" name="phoneNumber" type="tel" autoComplete="tel" placeholder="082 123 4567" />
            <label className="text-sm font-bold text-[#1b2b22] sm:col-span-2">
              South African ID number
              <input className={inputClass} name="southAfricanId" inputMode="numeric" autoComplete="off" maxLength={13} pattern="[0-9]{13}" required />
              <span className="mt-2 block text-xs font-medium text-[#627068]">Used once to confirm that you are 18 or older and prevent duplicate accounts. The complete number is not stored.</span>
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-black text-[#102018]">Delivery location</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-[#1b2b22] sm:col-span-2"><span>Street address</span><input className={inputClass} name="streetAddress" autoComplete="street-address" required /></label>
            <Field label="Unit or complex (optional)" name="unitDetails" required={false} />
            <Field label="Suburb" name="suburb" />
            <Field label="City" name="city" autoComplete="address-level2" />
            <label className="text-sm font-bold text-[#1b2b22]">Province<select className={inputClass} name="province" autoComplete="address-level1" required defaultValue="Gauteng">{SOUTH_AFRICAN_PROVINCES.map((province) => <option key={province}>{province}</option>)}</select></label>
            <Field label="Postal code" name="postalCode" autoComplete="postal-code" placeholder="0001" />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-[#102018]">Create your password</h2>
            <button type="button" onClick={() => setShowPasswords((value) => !value)} className="inline-flex items-center gap-2 text-sm font-bold text-[#087c39]">{showPasswords ? <EyeOff size={18} /> : <Eye size={18} />} {showPasswords ? "Hide" : "Show"}</button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Password" name="password" type={showPasswords ? "text" : "password"} autoComplete="new-password" />
            <Field label="Confirm password" name="confirmPassword" type={showPasswords ? "text" : "password"} autoComplete="new-password" />
          </div>
          <p className="mt-3 text-xs font-semibold text-[#627068]">Use at least 12 characters with uppercase, lowercase, a number and a special character.</p>
        </section>

        <section className="grid gap-3 rounded-2xl border-2 border-[#dce8df] bg-[#f4faf6] p-4 text-sm text-[#263a2f]">
          <label className="flex items-start gap-3"><input className="mt-1 size-4 accent-[#159447]" type="checkbox" name="acceptTerms" required /><span>I accept the <Link className="font-bold text-[#087c39] underline" href={"/legal/terms-of-service.pdf" as never} target="_blank">Terms and Conditions</Link>.</span></label>
          <label className="flex items-start gap-3"><input className="mt-1 size-4 accent-[#159447]" type="checkbox" name="acceptPrivacy" required /><span>I accept the <Link className="font-bold text-[#087c39] underline" href={"/legal/privacy-policy.pdf" as never} target="_blank">Privacy Policy</Link>.</span></label>
          <label className="flex items-start gap-3"><input className="mt-1 size-4 accent-[#159447]" type="checkbox" name="acceptPhysicalIdNotice" required /><span>I understand that a valid physical ID may be requested before a restricted product is handed over.</span></label>
          <label className="flex items-start gap-3"><input className="mt-1 size-4 accent-[#159447]" type="checkbox" name="marketingConsent" /><span>Send me optional GreenChoice product and store updates.</span></label>
        </section>

        <div className="rounded-2xl border-2 border-[#bfe5ca] bg-[#eaf8ee] p-4 text-sm font-semibold text-[#19582e]">
          <CheckCircle2 className="mr-2 inline" size={19} /> Remember your email and password. You will need them whenever you sign in to GreenChoice.
        </div>

        <button disabled={isSubmitting} className="inline-flex h-14 items-center justify-center gap-3 rounded-xl bg-[#087c39] text-lg font-black text-white shadow-[0_12px_30px_rgba(8,124,57,0.24)] transition hover:bg-[#096e35] disabled:opacity-60"><UserPlus size={22} />{isSubmitting ? "Creating account..." : "Create Customer Account"}</button>
      </form>
    </>
  );
}
