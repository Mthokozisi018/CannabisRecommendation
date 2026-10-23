import { z } from "zod";
import { southAfricanPhoneRegex, southAfricanProvinces } from "@/lib/manager/onboarding-options";
import { storeDayKeys } from "@/lib/manager/store-settings-fields";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid opening and closing time.");
const moneySchema = z.coerce.number().min(0, "Amounts cannot be negative.").max(1_000_000, "Amount is too large.");
const optionalNumber = (schema: z.ZodNumber) => z.preprocess((value) => value === "" || value === null ? undefined : value, schema.optional());

const storeSchema = z.object({
  name: z.string().trim().min(2, "Store name must be at least 2 characters.").max(100),
  publicDescription: z.string().trim().max(1000, "Store description must be 1000 characters or fewer.").optional(),
  contactEmail: z.string().trim().email("Enter a valid store contact email.").max(254).optional().or(z.literal("")),
  phoneNumber: z.string().trim().refine((value) => southAfricanPhoneRegex.test(value.replace(/\s/g, "")), "Enter a valid South African store phone number."),
  physicalAddress: z.string().trim().min(5, "Store address must be at least 5 characters.").max(240),
  city: z.string().trim().min(2, "City must be at least 2 characters.").max(120),
  province: z.enum(southAfricanProvinces),
  postalCode: z.string().trim().regex(/^[0-9]{4}$/, "Postal code must be 4 digits.")
});

const fulfillmentSchema = z.object({
  ordersEnabled: z.boolean(),
  collectionEnabled: z.boolean(),
  deliveryEnabled: z.boolean(),
  collectionLeadMinutes: z.coerce.number().int().min(0).max(1440),
  collectionMinimum: moneySchema,
  collectionFee: moneySchema,
  deliveryMinimum: moneySchema,
  deliveryFee: moneySchema,
  deliveryEtaMinMinutes: optionalNumber(z.coerce.number().int().min(1).max(1440)),
  deliveryEtaMaxMinutes: optionalNumber(z.coerce.number().int().min(1).max(1440)),
  deliveryRadiusKm: optionalNumber(z.coerce.number().positive().max(500))
}).superRefine((value, context) => {
  if (value.deliveryEtaMinMinutes && value.deliveryEtaMaxMinutes && value.deliveryEtaMaxMinutes < value.deliveryEtaMinMinutes) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["deliveryEtaMaxMinutes"], message: "Maximum delivery ETA cannot be less than the minimum ETA." });
  }
  if (value.deliveryEnabled && (!value.deliveryEtaMinMinutes || !value.deliveryEtaMaxMinutes || !value.deliveryRadiusKm)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["deliveryEnabled"], message: "Delivery ETA and radius are required when delivery is enabled." });
  }
});

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function normalizeSAPhone(value: string) {
  const compact = value.replace(/\s/g, "");
  if (compact.startsWith("+27")) return compact;
  if (compact.startsWith("27")) return `+${compact}`;
  if (compact.startsWith("0")) return `+27${compact.slice(1)}`;
  return compact;
}

export function parseManagerStoreForm(formData: FormData) {
  const store = storeSchema.parse({
    name: text(formData, "name"),
    publicDescription: text(formData, "publicDescription") || undefined,
    contactEmail: text(formData, "contactEmail"),
    phoneNumber: text(formData, "phoneNumber"),
    physicalAddress: text(formData, "physicalAddress"),
    city: text(formData, "city"),
    province: text(formData, "province"),
    postalCode: text(formData, "postalCode")
  });

  const openingHours = Object.fromEntries(storeDayKeys.map((day) => {
    const closed = formData.get(`${day}Closed`) === "on";
    if (closed) return [day, { closed: true }];
    const open = timeSchema.parse(text(formData, `${day}Open`));
    const close = timeSchema.parse(text(formData, `${day}Close`));
    if (open === close) throw new z.ZodError([{ code: z.ZodIssueCode.custom, path: [day], message: `${day[0].toUpperCase()}${day.slice(1)} opening and closing times must differ.` }]);
    return [day, { closed: false, open, close }];
  }));

  const fulfillment = fulfillmentSchema.parse({
    ordersEnabled: formData.get("ordersEnabled") === "on",
    collectionEnabled: formData.get("collectionEnabled") === "on",
    deliveryEnabled: formData.get("deliveryEnabled") === "on",
    collectionLeadMinutes: text(formData, "collectionLeadMinutes"),
    collectionMinimum: text(formData, "collectionMinimum"),
    collectionFee: text(formData, "collectionFee"),
    deliveryMinimum: text(formData, "deliveryMinimum"),
    deliveryFee: text(formData, "deliveryFee"),
    deliveryEtaMinMinutes: text(formData, "deliveryEtaMinMinutes"),
    deliveryEtaMaxMinutes: text(formData, "deliveryEtaMaxMinutes"),
    deliveryRadiusKm: text(formData, "deliveryRadiusKm")
  });

  return {
    store: {
      ...store,
      publicDescription: store.publicDescription || null,
      contactEmail: store.contactEmail || null,
      phoneNumber: normalizeSAPhone(store.phoneNumber),
      openingHours
    },
    fulfillment
  };
}
