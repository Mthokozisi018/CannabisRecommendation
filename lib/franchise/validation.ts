import { z } from "zod";
import {
  southAfricanPhoneRegex,
  southAfricanProvinces,
} from "@/lib/manager/onboarding-options";
export const phoneSchema = z
  .string()
  .trim()
  .refine(
    (value) => southAfricanPhoneRegex.test(value.replace(/\s/g, "")),
    "Enter a valid South African phone number.",
  );
const name = z.string().trim().min(2).max(120);
export const franchiseSchema = z.object({
  name,
  registrationNumber: z.string().trim().max(100),
  email: z.string().trim().email().max(254),
  phone: phoneSchema,
  address: z.string().trim().min(5).max(240),
});
export const personSchema = z.object({
  firstName: name,
  surname: name,
  phone: phoneSchema,
});
const staffCredentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1, "Enter a temporary password.").max(256),
});
export const staffCreateSchema = personSchema.extend({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1, "Enter a temporary password.").max(256),
  confirmPassword: z.string().min(1, "Confirm the temporary password.").max(256),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords must match.",
});
export const staffAssignmentSchema = z.discriminatedUnion("role", [
  staffCredentials.extend({ role: z.literal("manager") }),
  staffCredentials.extend({ role: z.literal("receptionist") }),
]);
export const storeSchema = z.object({
  name,
  email: z.string().trim().email().max(254).or(z.literal("")),
  phone: phoneSchema,
  address: z.string().trim().min(5).max(240),
  city: name,
  province: z.enum(southAfricanProvinces),
  postalCode: z.string().regex(/^\d{4}$/, "Postal code must be four digits."),
});
export const openingHoursSchema = z.record(
  z.enum([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]),
  z
    .object({
      closed: z.boolean(),
      open: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .optional(),
      close: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .optional(),
    })
    .refine(
      (v) => v.closed || Boolean(v.open && v.close && v.open !== v.close),
      "Set different opening and closing times.",
    ),
);
export function formValues(form: FormData) {
  return Object.fromEntries(
    [...form.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}
