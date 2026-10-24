import { z } from "zod";
import { normalizePOSCustomerPhone } from "@/lib/pos-customer-format";

export const MAX_DOCUMENT_BYTES = 6 * 1024 * 1024;
export const REGISTRATION_NOTICE_VERSION = "2026-10-07";
export const registrationSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(160),
  email: z.string().trim().toLowerCase().email("Enter your email address.").max(320),
  phoneNumber: z.string().max(30).refine(value => Boolean(normalizePOSCustomerPhone(value)), "Enter a valid South African cellphone number."),
  documentType: z.enum(["sa_id", "passport"]),
  documentNumber: z.string().trim().toUpperCase().max(30),
  acceptTerms: z.literal(true, { error: "Agree to the Customer Terms & Conditions." }),
  acceptPrivacy: z.literal(true, { error: "Acknowledge the Privacy Notice." }),
  acceptVerification: z.literal(true, { error: "Acknowledge the ID Verification Notice." }),
  marketing: z.boolean(),
  channels: z.array(z.enum(["email", "sms", "whatsapp"])).max(3),
  submissionId: z.string().uuid()
}).strict().superRefine((value, context) => {
  const names = value.fullName.split(/\s+/);
  if (names[0].length > 80 || names.slice(1).join(" ").length > 80) context.addIssue({ code: z.ZodIssueCode.custom, path: ["fullName"], message: "Use at most 80 characters for each part of your name." });
  const error = documentNumberError(value.documentType, value.documentNumber);
  if (error) context.addIssue({ code: z.ZodIssueCode.custom, path: ["documentNumber"], message: error });
  if (value.marketing && !value.channels.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["channels"], message: "Choose a promotional channel or leave promotions unticked." });
});
export type RegistrationInput = z.infer<typeof registrationSchema>;

export function luhnValid(value: string) {
  let total = 0;
  for (let i = value.length - 1, offset = 0; i >= 0; i--, offset++) {
    let digit = Number(value[i]);
    if (offset % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    total += digit;
  }
  return total % 10 === 0;
}

export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function documentNumberError(type: "sa_id" | "passport", value: string) {
  if (type === "passport") return /^[A-Z0-9]{5,20}$/.test(value) ? null : "Enter a passport number of 5–20 letters or digits.";
  if (!/^\d{13}$/.test(value) || !luhnValid(value)) return "Enter a valid 13-digit SA ID number, including its checksum.";
  // Do not guess a century to determine adulthood. The provider's full DOB must resolve it.
  const tail = `${value.slice(2, 4)}-${value.slice(4, 6)}`;
  return [1900, 2000].some(century => validDate(`${century + Number(value.slice(0, 2))}-${tail}`)) ? null : "The date in this SA ID is invalid.";
}

export function ageAt(dateOfBirth: string, today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" })) {
  if (!validDate(dateOfBirth) || dateOfBirth > today) return null;
  let age = Number(today.slice(0, 4)) - Number(dateOfBirth.slice(0, 4));
  if (today.slice(5) < dateOfBirth.slice(5)) age--;
  return age >= 0 && age <= 120 ? age : null;
}

export function maskPhone(display: string) {
  const digits = display.replace(/\D/g, "");
  return `${digits.slice(0, 3)} *** ${digits.slice(-4)}`;
}
