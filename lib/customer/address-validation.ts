import { z } from "zod";
import { SOUTH_AFRICAN_PROVINCES } from "@/lib/customer/validation";

export const customerAddressSchema = z.object({
  label: z.string().trim().min(1).max(40),
  streetAddress: z.string().trim().min(3).max(180),
  unitDetails: z.string().trim().max(100),
  suburb: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  province: z.enum(SOUTH_AFRICAN_PROVINCES),
  postalCode: z.string().trim().regex(/^\d{4}$/),
});

export function addressFormValues(formData: FormData) {
  return Object.fromEntries(["label", "streetAddress", "unitDetails", "suburb", "city", "province", "postalCode"].map((key) => [key, typeof formData.get(key) === "string" ? formData.get(key) : ""]));
}

export function addressRecord(input: z.infer<typeof customerAddressSchema>) {
  return { label: input.label, street_address: input.streetAddress, unit_details: input.unitDetails || null, suburb: input.suburb, city: input.city, province: input.province, postal_code: input.postalCode, country: "South Africa" };
}

export type CustomerAddress = {
  id: string; label: string; street_address: string; unit_details: string | null;
  suburb: string; city: string; province: string; postal_code: string; is_default: boolean;
};
