import crypto from "node:crypto";
import { z } from "zod";

export const SOUTH_AFRICAN_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape"
] as const;

export const customerRegistrationSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  surname: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(320),
  phoneNumber: z.string().trim().min(10).max(20),
  southAfricanId: z.string().trim().regex(/^\d{13}$/, "Enter a valid 13-digit South African ID number."),
  password: z.string()
    .min(12, "Your permanent password must contain at least 12 characters.")
    .max(128)
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number.")
    .regex(/[^A-Za-z0-9]/, "Include a special character."),
  confirmPassword: z.string(),
  streetAddress: z.string().trim().min(3).max(180),
  unitDetails: z.string().trim().max(100).optional().default(""),
  suburb: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  province: z.enum(SOUTH_AFRICAN_PROVINCES),
  postalCode: z.string().trim().regex(/^\d{4}$/, "Enter a valid four-digit postal code."),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
  acceptPhysicalIdNotice: z.literal(true),
  marketingConsent: z.boolean().optional().default(false)
}).strict().superRefine((value, context) => {
  if (value.password !== value.confirmPassword) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "Passwords do not match." });
  }
});

export function normalizeSouthAfricanPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return `+27${digits.slice(1)}`;
  if (/^27\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\d{9}$/.test(digits)) return `+27${digits}`;
  return null;
}

function isValidDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function luhnValid(value: string) {
  let sum = 0;
  let doubleDigit = false;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

export function validateSouthAfricanId(value: string, now = new Date()) {
  if (!/^\d{13}$/.test(value) || !luhnValid(value)) {
    return { valid: false as const, message: "Enter a valid South African ID number." };
  }

  const shortYear = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  const currentYear = now.getUTCFullYear();
  let year = Math.floor(currentYear / 100) * 100 + shortYear;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getTime() > now.getTime()) year -= 100;
  if (!isValidDate(year, month, day)) {
    return { valid: false as const, message: "The birth date in this ID number is invalid." };
  }

  let age = currentYear - year;
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
  if (age < 18) {
    return { valid: false as const, message: "You must be at least 18 years old to create a GreenChoice customer account." };
  }

  return {
    valid: true as const,
    dateOfBirth: `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
    age,
    lastFour: value.slice(-4)
  };
}

export function customerIdFingerprint(value: string) {
  const secret = process.env.CUSTOMER_ID_HMAC_SECRET || process.env.SESSION_SIGNING_SECRET || process.env.CSRF_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("Customer identity protection is not configured.");
  }
  return crypto.createHmac("sha256", secret || "greenchoice-local-customer-id-secret").update(`za-id:${value}`).digest("hex");
}

