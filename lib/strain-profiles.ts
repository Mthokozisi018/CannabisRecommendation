export type StaticStrainProfileKey = "sativa" | "indica" | "hybrid";

export type StaticStrainEffect = {
  label: string;
  context: string;
  imageSrc: string;
};

export type StaticStrainProfile = {
  key: StaticStrainProfileKey;
  title: string;
  description: string;
  effects: StaticStrainEffect[];
  bestTime: string;
  bestTimeImageSrc: string;
};

export const STRAIN_INFO_PROFILES: Record<StaticStrainProfileKey, StaticStrainProfile> = {
  sativa: {
    key: "sativa",
    title: "Sativa",
    description:
      "Sativa strains are commonly reported by users as uplifting and energizing experiences that may feel creative, focused, or social.",
    effects: [
      { label: "Uplifted", context: "Mood", imageSrc: "/badges/sativa/uplifted.png" },
      { label: "Energetic", context: "Experience", imageSrc: "/badges/sativa/energetic.png" },
      { label: "Focused", context: "Mental", imageSrc: "/badges/sativa/focused.png" },
      { label: "Creative", context: "Creative", imageSrc: "/badges/sativa/creative.png" },
      { label: "Social", context: "Social", imageSrc: "/badges/sativa/social.png" }
    ],
    bestTime: "Daytime",
    bestTimeImageSrc: "/badges/sativa/daytime.png"
  },
  indica: {
    key: "indica",
    title: "Indica",
    description:
      "Indica strains are commonly reported by users as relaxing, body-heavy experiences that may feel calm, sleepy, or appetite-friendly.",
    effects: [
      { label: "Body High", context: "Body", imageSrc: "/badges/indica/body-high.png" },
      { label: "Couchlock", context: "Experience", imageSrc: "/badges/indica/couchlock.png" },
      { label: "Appetite", context: "Appetite", imageSrc: "/badges/indica/appetite.png" },
      { label: "Sleepy", context: "Rest", imageSrc: "/badges/indica/sleepy.png" },
      { label: "Relaxed", context: "Mood", imageSrc: "/badges/indica/relaxed.png" }
    ],
    bestTime: "Night Time",
    bestTimeImageSrc: "/badges/indica/night-time.png"
  },
  hybrid: {
    key: "hybrid",
    title: "Hybrid",
    description:
      "Hybrid strains are commonly reported by users as a balanced experience that may feel both uplifting and relaxing depending on the person and strain.",
    effects: [
      { label: "Balanced", context: "Overall", imageSrc: "/badges/hybrid/balanced.png" },
      { label: "Uplifted", context: "Mood", imageSrc: "/badges/hybrid/uplifted.png" },
      { label: "Relaxed", context: "Body", imageSrc: "/badges/hybrid/relaxed.png" },
      { label: "Focused", context: "Mental", imageSrc: "/badges/hybrid/focused.png" },
      { label: "Smooth", context: "Experience", imageSrc: "/badges/hybrid/smooth.png" }
    ],
    bestTime: "Anytime",
    bestTimeImageSrc: "/badges/hybrid/anytime.png"
  }
};

const STATIC_STRAIN_CATEGORY_KEYS = new Set([
  "flower",
  "preroll",
  "prerolls",
  "vapecartridge",
  "vapecartridges"
]);

const STRAIN_SUBCATEGORY_KEYS: Record<string, StaticStrainProfileKey> = {
  sativa: "sativa",
  indica: "indica",
  hybrid: "hybrid"
};

function normalizeStaticStrainMatch(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
}

export function categoryUsesStaticStrainDescriptions(category: string | null | undefined) {
  return STATIC_STRAIN_CATEGORY_KEYS.has(normalizeStaticStrainMatch(category));
}

export function getStaticStrainProfile(subcategory: string | null | undefined) {
  const normalized = normalizeStaticStrainMatch(subcategory);
  const profileKey =
    STRAIN_SUBCATEGORY_KEYS[normalized] ??
    (normalized.includes("hybrid") ? "hybrid" : normalized.includes("sativa") ? "sativa" : normalized.includes("indica") ? "indica" : undefined);
  return profileKey ? STRAIN_INFO_PROFILES[profileKey] : null;
}

export function getStaticStrainProfileForProduct(product: {
  category?: string | null;
  categoryName?: string | null;
  subcategory?: string | null;
  strainType?: string | null;
}) {
  const category = product.categoryName || product.category;
  if (!categoryUsesStaticStrainDescriptions(category)) return null;
  return getStaticStrainProfile(product.strainType) ?? getStaticStrainProfile(product.subcategory);
}

export function isStaticStrainDescriptionProduct(product: {
  category?: string | null;
  categoryName?: string | null;
  subcategory?: string | null;
  strainType?: string | null;
}) {
  return getStaticStrainProfileForProduct(product) !== null;
}
