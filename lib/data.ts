import type { CategoryDTO, EffectDTO, ProductDTO, StaffDTO, StoreDTO } from "./types";

export const STORE: StoreDTO = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "greenchoice-main",
  name: "GreenChoice Sandton",
  currencyCode: "ZAR",
  timezone: "Africa/Johannesburg"
};

export const LOCAL_STAFF: StaffDTO = {
  id: "00000000-0000-4000-8000-000000000010",
  displayName: "Ava Mokoena",
  email: "admin@greenchoice.local",
  role: "admin",
  storeId: STORE.id
};

export const EFFECTS: EffectDTO[] = [
  { id: "10000000-0000-4000-8000-000000000001", slug: "relaxed", name: "Relaxed", description: "User-reported calm and unwind tags.", icon: "Leaf", sortOrder: 1 },
  { id: "10000000-0000-4000-8000-000000000002", slug: "focused", name: "Focused", description: "User-reported clarity and task tags.", icon: "Target", sortOrder: 2 },
  { id: "10000000-0000-4000-8000-000000000003", slug: "creative", name: "Creative", description: "User-reported idea-flow tags.", icon: "Sparkles", sortOrder: 3 },
  { id: "10000000-0000-4000-8000-000000000004", slug: "sleepy", name: "Sleepy", description: "User-reported night and wind-down tags.", icon: "Moon", sortOrder: 4 },
  { id: "10000000-0000-4000-8000-000000000005", slug: "euphoric", name: "Euphoric", description: "User-reported uplift tags.", icon: "Smile", sortOrder: 5 },
  { id: "10000000-0000-4000-8000-000000000006", slug: "energetic", name: "Energetic", description: "User-reported active and daytime tags.", icon: "Zap", sortOrder: 6 }
];

export const CATEGORIES: CategoryDTO[] = [
  { id: "20000000-0000-4000-8000-000000000001", slug: "flower", name: "Flower", icon: "Flower", parentId: null, subcategories: ["Indoor", "Greenhouse", "Outdoor"], sortOrder: 1 },
  { id: "20000000-0000-4000-8000-000000000002", slug: "pre-rolls", name: "Pre-rolls", icon: "Cigarette", parentId: null, subcategories: ["Pre-rolls", "Infused Pre-rolls", "Moon Sticks", "Multi-pack", "Single Pre-roll"], sortOrder: 2 },
  { id: "20000000-0000-4000-8000-000000000003", slug: "edibles", name: "Edibles", icon: "Cookie", parentId: null, subcategories: ["Gummies", "Chocolates", "Cookies", "Beverages", "Other Edibles"], sortOrder: 3 },
  { id: "20000000-0000-4000-8000-000000000004", slug: "oils-supplements", name: "Oils & Supplements", icon: "Droplet", parentId: null, subcategories: ["Oils / Tinctures", "Softgels / Capsules", "Topicals", "Wellness Supplements"], sortOrder: 4 },
  { id: "20000000-0000-4000-8000-000000000005", slug: "vapes", name: "Vapes", icon: "BatteryCharging", parentId: null, subcategories: ["Cartridges", "Disposable Vapes", "Battery Packs", "Vape Kits"], sortOrder: 5 },
  { id: "20000000-0000-4000-8000-000000000006", slug: "concentrates", name: "Concentrates", icon: "Gem", parentId: null, subcategories: ["Wax", "Shatter", "Live Resin", "Rosin"], sortOrder: 6 }
];

const productImages = (slug: string, name: string) => [
  { storagePath: `/products/${slug}-1.svg`, altText: `${name} package`, isPrimary: true },
  { storagePath: `/products/${slug}-2.svg`, altText: `${name} detail` }
];

type ProductSeed = Omit<ProductDTO, "id" | "storeId" | "categoryName" | "images" | "lineage"> & {
  categorySlug: string;
  lineage?: ProductDTO["lineage"];
};

const categoryName = (slug: string) => CATEGORIES.find((category) => category.slug === slug)?.name ?? slug;
const effect = (slug: string, scorePct: number) => ({ slug, name: EFFECTS.find((item) => item.slug === slug)?.name ?? slug, scorePct });
const terpene = (slug: string, name: string, pct: number, rankOrder: number, description = "Aromatic compound used here as an informational product attribute.") => ({ slug, name, pct, rankOrder, description });
const flavor = (slug: string, name: string) => ({ slug, name });

const seeds: ProductSeed[] = [
  {
    categorySlug: "flower",
    subcategorySlug: "Indoor",
    slug: "gelato-33",
    name: "Gelato #33",
    brand: "Emerald Room",
    strainType: "Hybrid",
    growType: "Indoor",
    geneticsSummary: "Sunset Sherbet x Thin Mint GSC",
    bestTimeOfUse: "Late afternoon or relaxed evening browsing.",
    description: "Dense indoor flower with dessert aromatics, balanced user-reported uplift, and a smooth finish. Effect tags are informational and based on product metadata.",
    priceCents: 18500,
    sizeLabel: "3.5 g",
    ratingAvg: 4.8,
    ratingCount: 214,
    thcValue: 24.2,
    thcUnit: "%",
    cbdValue: 0.6,
    cbdUnit: "%",
    terpeneTotalPct: 2.4,
    isLabTested: true,
    isOnSpecial: false,
    isNew: true,
    stockStatus: "in_stock",
    stockOnHand: 28,
    facetValues: { aroma: "Dessert", ratioTag: "THC-forward", dietary: "", harvestBatch: "GC-0626-A" },
    effects: [effect("relaxed", 92), effect("euphoric", 88), effect("creative", 72), effect("sleepy", 42)],
    terpenes: [terpene("limonene", "Limonene", 0.82, 1), terpene("caryophyllene", "Caryophyllene", 0.71, 2), terpene("linalool", "Linalool", 0.31, 3)],
    flavors: [flavor("sweet", "Sweet"), flavor("vanilla", "Vanilla"), flavor("berry", "Berry")],
    lineage: [
      { slug: "sunset-sherbet", name: "Sunset Sherbet", relationType: "parent" },
      { slug: "thin-mint-gsc", name: "Thin Mint GSC", relationType: "parent" }
    ]
  },
  { categorySlug: "flower", subcategorySlug: "Greenhouse", slug: "blue-dream-gh", name: "Blue Dream Greenhouse", brand: "Canopy Lane", strainType: "Sativa Hybrid", growType: "Greenhouse", bestTimeOfUse: "Daytime staff-guided browsing.", description: "Bright greenhouse flower with user-reported creative and focused tags.", priceCents: 14500, sizeLabel: "3.5 g", ratingAvg: 4.5, ratingCount: 132, thcValue: 21, thcUnit: "%", cbdValue: 0.3, cbdUnit: "%", terpeneTotalPct: 1.8, isLabTested: true, isOnSpecial: true, isNew: false, stockStatus: "in_stock", stockOnHand: 41, facetValues: { aroma: "Berry", ratioTag: "THC-forward" }, effects: [effect("creative", 88), effect("focused", 75), effect("energetic", 68)], terpenes: [terpene("pinene", "Pinene", 0.55, 1), terpene("myrcene", "Myrcene", 0.43, 2)], flavors: [flavor("berry", "Berry"), flavor("herbal", "Herbal")] },
  { categorySlug: "flower", subcategorySlug: "Outdoor", slug: "durban-poison-outdoor", name: "Durban Poison Outdoor", brand: "Highveld Herb", strainType: "Sativa", growType: "Outdoor", bestTimeOfUse: "Morning or early afternoon.", description: "Classic outdoor profile with energetic and focused product tags.", priceCents: 9900, sizeLabel: "3.5 g", ratingAvg: 4.3, ratingCount: 98, thcValue: 19.5, thcUnit: "%", cbdValue: 0.2, cbdUnit: "%", terpeneTotalPct: 1.5, isLabTested: false, isOnSpecial: false, isNew: false, stockStatus: "low_stock", stockOnHand: 7, facetValues: { aroma: "Anise", ratioTag: "THC-forward" }, effects: [effect("energetic", 91), effect("focused", 86), effect("creative", 62)], terpenes: [terpene("terpinolene", "Terpinolene", 0.62, 1)], flavors: [flavor("spicy", "Spicy"), flavor("citrus", "Citrus")] },
  { categorySlug: "flower", subcategorySlug: "Indoor", slug: "northern-lights", name: "Northern Lights", brand: "Night Garden", strainType: "Indica", growType: "Indoor", bestTimeOfUse: "Evening.", description: "Indoor indica flower with relaxed and sleepy tags.", priceCents: 16900, sizeLabel: "3.5 g", ratingAvg: 4.7, ratingCount: 176, thcValue: 22.8, thcUnit: "%", cbdValue: 0.5, cbdUnit: "%", terpeneTotalPct: 2.1, isLabTested: true, isOnSpecial: false, isNew: false, stockStatus: "in_stock", stockOnHand: 22, facetValues: { aroma: "Earthy", ratioTag: "THC-forward" }, effects: [effect("sleepy", 94), effect("relaxed", 90), effect("euphoric", 48)], terpenes: [terpene("myrcene", "Myrcene", 0.9, 1), terpene("linalool", "Linalool", 0.38, 2)], flavors: [flavor("earthy", "Earthy"), flavor("pine", "Pine")] },
  { categorySlug: "flower", subcategorySlug: "Indoor", slug: "jack-herer", name: "Jack Herer", brand: "Citrus Club", strainType: "Sativa Hybrid", growType: "Indoor", bestTimeOfUse: "Daytime.", description: "Crisp indoor flower with focused and creative tags.", priceCents: 17500, sizeLabel: "3.5 g", ratingAvg: 4.6, ratingCount: 141, thcValue: 20.6, thcUnit: "%", cbdValue: 0.4, cbdUnit: "%", terpeneTotalPct: 1.9, isLabTested: true, isOnSpecial: false, isNew: true, stockStatus: "in_stock", stockOnHand: 17, facetValues: { aroma: "Citrus", ratioTag: "THC-forward" }, effects: [effect("focused", 92), effect("creative", 84), effect("energetic", 74)], terpenes: [terpene("pinene", "Pinene", 0.6, 1), terpene("limonene", "Limonene", 0.5, 2)], flavors: [flavor("citrus", "Citrus"), flavor("pine", "Pine")] },
  { categorySlug: "pre-rolls", subcategorySlug: "Single Pre-roll", slug: "gelato-33-single-pre-roll", name: "Gelato #33 Single Pre-roll", brand: "Emerald Room", strainType: "Hybrid", growType: "Indoor", bestTimeOfUse: "Late afternoon.", description: "Single pre-roll using Gelato #33 flower.", priceCents: 6500, sizeLabel: "1 g", ratingAvg: 4.5, ratingCount: 74, thcValue: 23, thcUnit: "%", cbdValue: 0.5, cbdUnit: "%", terpeneTotalPct: 2, isLabTested: true, isOnSpecial: false, isNew: true, stockStatus: "in_stock", stockOnHand: 68, facetValues: { packSize: "Single", ratioTag: "THC-forward" }, effects: [effect("relaxed", 88), effect("euphoric", 80), effect("creative", 64)], terpenes: [terpene("limonene", "Limonene", 0.72, 1)], flavors: [flavor("sweet", "Sweet")] },
  { categorySlug: "pre-rolls", subcategorySlug: "Multi-pack", slug: "day-shift-pre-roll-pack", name: "Day Shift Pre-roll Pack", brand: "Highveld Herb", strainType: "Sativa", bestTimeOfUse: "Daytime.", description: "Five-pack pre-rolls with energetic and focused tags.", priceCents: 21000, sizeLabel: "5 x 0.5 g", ratingAvg: 4.4, ratingCount: 89, thcValue: 18.5, thcUnit: "%", cbdValue: 0.2, cbdUnit: "%", terpeneTotalPct: 1.6, isLabTested: true, isOnSpecial: true, isNew: false, stockStatus: "in_stock", stockOnHand: 35, facetValues: { packSize: "Multi-pack", ratioTag: "THC-forward" }, effects: [effect("energetic", 90), effect("focused", 82)], terpenes: [terpene("terpinolene", "Terpinolene", 0.5, 1)], flavors: [flavor("citrus", "Citrus")] },
  { categorySlug: "pre-rolls", subcategorySlug: "Infused Pre-rolls", slug: "moon-mint-infused-pre-roll", name: "Moon Mint Infused Pre-roll", brand: "Night Garden", strainType: "Indica Hybrid", bestTimeOfUse: "Evening.", description: "Infused pre-roll with relaxed and sleepy tags.", priceCents: 12000, sizeLabel: "1 g", ratingAvg: 4.6, ratingCount: 63, thcValue: 34, thcUnit: "%", cbdValue: 0.4, cbdUnit: "%", terpeneTotalPct: 2.2, isLabTested: true, isOnSpecial: false, isNew: false, stockStatus: "low_stock", stockOnHand: 9, facetValues: { infusion: "Kief", ratioTag: "High THC" }, effects: [effect("sleepy", 90), effect("relaxed", 86), effect("euphoric", 55)], terpenes: [terpene("myrcene", "Myrcene", 0.8, 1)], flavors: [flavor("mint", "Mint")] },
  { categorySlug: "pre-rolls", subcategorySlug: "Moon Sticks", slug: "cosmic-cake-moon-stick", name: "Cosmic Cake Moon Stick", brand: "Emerald Room", strainType: "Hybrid", bestTimeOfUse: "Evening.", description: "Moon stick format with bold dessert flavor tags.", priceCents: 16500, sizeLabel: "1.2 g", ratingAvg: 4.7, ratingCount: 48, thcValue: 38, thcUnit: "%", cbdValue: 0.2, cbdUnit: "%", terpeneTotalPct: 2.5, isLabTested: true, isOnSpecial: false, isNew: true, stockStatus: "in_stock", stockOnHand: 18, facetValues: { infusion: "Rosin", ratioTag: "High THC" }, effects: [effect("euphoric", 86), effect("relaxed", 78), effect("creative", 58)], terpenes: [terpene("caryophyllene", "Caryophyllene", 0.7, 1)], flavors: [flavor("vanilla", "Vanilla")] },
  { categorySlug: "edibles", subcategorySlug: "Gummies", slug: "balanced-berry-gummies", name: "Balanced Berry Gummies", brand: "Kind Kitchen", bestTimeOfUse: "Evening.", description: "Berry gummies tagged for balanced THC/CBD preference.", priceCents: 14500, sizeLabel: "10 x 10 mg", ratingAvg: 4.8, ratingCount: 203, thcValue: 10, thcUnit: "mg", cbdValue: 10, cbdUnit: "mg", terpeneTotalPct: 0, isLabTested: true, isOnSpecial: false, isNew: false, stockStatus: "in_stock", stockOnHand: 60, facetValues: { dietary: "Vegan", ratioTag: "1:1", format: "Gummy" }, effects: [effect("relaxed", 84), effect("sleepy", 62), effect("euphoric", 46)], terpenes: [], flavors: [flavor("berry", "Berry")] },
  { categorySlug: "edibles", subcategorySlug: "Chocolates", slug: "midnight-dark-chocolate", name: "Midnight Dark Chocolate", brand: "Kind Kitchen", bestTimeOfUse: "Night.", description: "Dark chocolate edible with sleepy and relaxed tags.", priceCents: 17500, sizeLabel: "100 mg", ratingAvg: 4.6, ratingCount: 119, thcValue: 100, thcUnit: "mg", cbdValue: 0, cbdUnit: "mg", terpeneTotalPct: 0, isLabTested: true, isOnSpecial: true, isNew: false, stockStatus: "in_stock", stockOnHand: 29, facetValues: { dietary: "Gluten-free", ratioTag: "THC-forward", format: "Chocolate" }, effects: [effect("sleepy", 90), effect("relaxed", 82)], terpenes: [], flavors: [flavor("cocoa", "Cocoa")] },
  { categorySlug: "edibles", subcategorySlug: "Cookies", slug: "creative-cookie-bites", name: "Creative Cookie Bites", brand: "Baked Table", bestTimeOfUse: "Afternoon.", description: "Cookie bites with creative and euphoric tags.", priceCents: 13000, sizeLabel: "5 x 5 mg", ratingAvg: 4.2, ratingCount: 52, thcValue: 5, thcUnit: "mg", cbdValue: 0, cbdUnit: "mg", terpeneTotalPct: 0, isLabTested: false, isOnSpecial: false, isNew: true, stockStatus: "in_stock", stockOnHand: 24, facetValues: { dietary: "Vegetarian", ratioTag: "Low dose", format: "Cookie" }, effects: [effect("creative", 76), effect("euphoric", 70), effect("relaxed", 45)], terpenes: [], flavors: [flavor("vanilla", "Vanilla")] },
  { categorySlug: "edibles", subcategorySlug: "Beverages", slug: "sparkling-citrus-social", name: "Sparkling Citrus Social", brand: "Sip Society", bestTimeOfUse: "Early evening.", description: "Low-dose beverage with euphoric and energetic tags.", priceCents: 7500, sizeLabel: "5 mg can", ratingAvg: 4.4, ratingCount: 88, thcValue: 5, thcUnit: "mg", cbdValue: 2, cbdUnit: "mg", terpeneTotalPct: 0, isLabTested: true, isOnSpecial: false, isNew: true, stockStatus: "in_stock", stockOnHand: 80, facetValues: { dietary: "Vegan", ratioTag: "Low dose", format: "Beverage" }, effects: [effect("euphoric", 82), effect("energetic", 68)], terpenes: [], flavors: [flavor("citrus", "Citrus")] },
  { categorySlug: "oils-supplements", subcategorySlug: "Oils / Tinctures", slug: "calm-11-tincture", name: "Calm 1:1 Tincture", brand: "WellLeaf", bestTimeOfUse: "Evening.", description: "Oil tincture with balanced ratio tag and relaxed metadata.", priceCents: 32000, sizeLabel: "30 ml", ratingAvg: 4.7, ratingCount: 156, thcValue: 500, thcUnit: "mg", cbdValue: 500, cbdUnit: "mg", terpeneTotalPct: 0, isLabTested: true, isOnSpecial: false, isNew: false, stockStatus: "in_stock", stockOnHand: 32, facetValues: { ratioTag: "1:1", dietary: "Vegan", carrier: "MCT" }, effects: [effect("relaxed", 88), effect("sleepy", 54)], terpenes: [], flavors: [flavor("neutral", "Neutral")] },
  { categorySlug: "oils-supplements", subcategorySlug: "Softgels / Capsules", slug: "focus-softgels", name: "Focus Softgels", brand: "WellLeaf", bestTimeOfUse: "Morning.", description: "Capsules tagged for focused daytime browsing.", priceCents: 28500, sizeLabel: "20 caps", ratingAvg: 4.5, ratingCount: 77, thcValue: 2.5, thcUnit: "mg", cbdValue: 10, cbdUnit: "mg", terpeneTotalPct: 0, isLabTested: true, isOnSpecial: true, isNew: false, stockStatus: "in_stock", stockOnHand: 38, facetValues: { ratioTag: "CBD-forward", dietary: "Vegan" }, effects: [effect("focused", 84), effect("relaxed", 58)], terpenes: [], flavors: [flavor("neutral", "Neutral")] },
  { categorySlug: "oils-supplements", subcategorySlug: "Topicals", slug: "mint-recovery-balm", name: "Mint Recovery Balm", brand: "Body Bloom", bestTimeOfUse: "Anytime.", description: "Topical balm with mint flavor/aroma metadata.", priceCents: 19000, sizeLabel: "50 ml", ratingAvg: 4.3, ratingCount: 66, thcValue: 0, thcUnit: "mg", cbdValue: 250, cbdUnit: "mg", terpeneTotalPct: 0, isLabTested: true, isOnSpecial: false, isNew: false, stockStatus: "in_stock", stockOnHand: 26, facetValues: { ratioTag: "CBD-only", dietary: "Vegan" }, effects: [effect("relaxed", 64)], terpenes: [], flavors: [flavor("mint", "Mint")] },
  { categorySlug: "oils-supplements", subcategorySlug: "Wellness Supplements", slug: "sleep-cbd-drops", name: "Sleep CBD Drops", brand: "WellLeaf", bestTimeOfUse: "Night.", description: "CBD-forward drops tagged for sleepy browsing.", priceCents: 29500, sizeLabel: "30 ml", ratingAvg: 4.4, ratingCount: 102, thcValue: 0, thcUnit: "mg", cbdValue: 1000, cbdUnit: "mg", terpeneTotalPct: 0, isLabTested: true, isOnSpecial: false, isNew: true, stockStatus: "low_stock", stockOnHand: 8, facetValues: { ratioTag: "CBD-only", dietary: "Vegan" }, effects: [effect("sleepy", 82), effect("relaxed", 72)], terpenes: [], flavors: [flavor("herbal", "Herbal")] },
  { categorySlug: "vapes", subcategorySlug: "Cartridges", slug: "lemon-haze-cartridge", name: "Lemon Haze Cartridge", brand: "Cloud Craft", strainType: "Sativa", bestTimeOfUse: "Daytime.", description: "510 cartridge with energetic and focused tags.", priceCents: 36000, sizeLabel: "1 g", ratingAvg: 4.6, ratingCount: 123, thcValue: 78, thcUnit: "%", cbdValue: 0.5, cbdUnit: "%", terpeneTotalPct: 5.2, isLabTested: true, isOnSpecial: false, isNew: false, stockStatus: "in_stock", stockOnHand: 44, facetValues: { hardwareFacet: "510 thread", ratioTag: "High THC" }, effects: [effect("energetic", 88), effect("focused", 80), effect("creative", 60)], terpenes: [terpene("limonene", "Limonene", 1.5, 1)], flavors: [flavor("citrus", "Citrus")] },
  { categorySlug: "vapes", subcategorySlug: "Disposable Vapes", slug: "berry-dream-disposable", name: "Berry Dream Disposable", brand: "Cloud Craft", strainType: "Hybrid", bestTimeOfUse: "Afternoon.", description: "Disposable vape with relaxed and creative metadata.", priceCents: 42000, sizeLabel: "1 g", ratingAvg: 4.5, ratingCount: 95, thcValue: 74, thcUnit: "%", cbdValue: 1, cbdUnit: "%", terpeneTotalPct: 4.8, isLabTested: true, isOnSpecial: true, isNew: true, stockStatus: "in_stock", stockOnHand: 25, facetValues: { hardwareFacet: "Rechargeable", ratioTag: "High THC" }, effects: [effect("relaxed", 74), effect("creative", 76), effect("euphoric", 70)], terpenes: [terpene("myrcene", "Myrcene", 1.2, 1)], flavors: [flavor("berry", "Berry")] },
  { categorySlug: "vapes", subcategorySlug: "Battery Packs", slug: "palm-510-battery", name: "Palm 510 Battery", brand: "Cloud Craft", bestTimeOfUse: "Accessory.", description: "Compact 510 battery pack for compatible cartridges.", priceCents: 18000, sizeLabel: "650 mAh", ratingAvg: 4.2, ratingCount: 46, thcValue: 0, thcUnit: "%", cbdValue: 0, cbdUnit: "%", terpeneTotalPct: 0, isLabTested: false, isOnSpecial: false, isNew: false, stockStatus: "in_stock", stockOnHand: 55, facetValues: { hardwareFacet: "510 thread", voltage: "Variable", ratioTag: "Accessory" }, effects: [effect("focused", 10)], terpenes: [], flavors: [] },
  { categorySlug: "vapes", subcategorySlug: "Vape Kits", slug: "starter-vape-kit", name: "Starter Vape Kit", brand: "Cloud Craft", bestTimeOfUse: "Accessory.", description: "Starter kit with battery and charger.", priceCents: 26000, sizeLabel: "Kit", ratingAvg: 4.4, ratingCount: 37, thcValue: 0, thcUnit: "%", cbdValue: 0, cbdUnit: "%", terpeneTotalPct: 0, isLabTested: false, isOnSpecial: false, isNew: true, stockStatus: "in_stock", stockOnHand: 21, facetValues: { hardwareFacet: "Starter kit", voltage: "Fixed", ratioTag: "Accessory" }, effects: [effect("focused", 10)], terpenes: [], flavors: [] },
  { categorySlug: "concentrates", subcategorySlug: "Wax", slug: "citrus-wax", name: "Citrus Wax", brand: "Extract House", strainType: "Sativa Hybrid", bestTimeOfUse: "Daytime.", description: "Wax concentrate with energetic metadata.", priceCents: 39000, sizeLabel: "1 g", ratingAvg: 4.5, ratingCount: 82, thcValue: 72, thcUnit: "%", cbdValue: 0.2, cbdUnit: "%", terpeneTotalPct: 6.1, isLabTested: true, isOnSpecial: false, isNew: false, stockStatus: "in_stock", stockOnHand: 19, facetValues: { concentrateSubtype: "Wax", ratioTag: "High THC" }, effects: [effect("energetic", 82), effect("focused", 72)], terpenes: [terpene("limonene", "Limonene", 1.9, 1)], flavors: [flavor("citrus", "Citrus")] },
  { categorySlug: "concentrates", subcategorySlug: "Shatter", slug: "pine-shatter", name: "Pine Shatter", brand: "Extract House", strainType: "Hybrid", bestTimeOfUse: "Afternoon.", description: "Shatter concentrate with creative tags.", priceCents: 41000, sizeLabel: "1 g", ratingAvg: 4.3, ratingCount: 61, thcValue: 76, thcUnit: "%", cbdValue: 0.3, cbdUnit: "%", terpeneTotalPct: 4.6, isLabTested: true, isOnSpecial: true, isNew: false, stockStatus: "low_stock", stockOnHand: 6, facetValues: { concentrateSubtype: "Shatter", ratioTag: "High THC" }, effects: [effect("creative", 80), effect("euphoric", 72)], terpenes: [terpene("pinene", "Pinene", 1.2, 1)], flavors: [flavor("pine", "Pine")] },
  { categorySlug: "concentrates", subcategorySlug: "Live Resin", slug: "mango-live-resin", name: "Mango Live Resin", brand: "Extract House", strainType: "Hybrid", bestTimeOfUse: "Early evening.", description: "Live resin with euphoric and relaxed tags.", priceCents: 48000, sizeLabel: "1 g", ratingAvg: 4.8, ratingCount: 91, thcValue: 73, thcUnit: "%", cbdValue: 0.4, cbdUnit: "%", terpeneTotalPct: 7.2, isLabTested: true, isOnSpecial: false, isNew: true, stockStatus: "in_stock", stockOnHand: 14, facetValues: { concentrateSubtype: "Live Resin", ratioTag: "High THC" }, effects: [effect("euphoric", 88), effect("relaxed", 72)], terpenes: [terpene("myrcene", "Myrcene", 1.8, 1)], flavors: [flavor("mango", "Mango")] },
  { categorySlug: "concentrates", subcategorySlug: "Rosin", slug: "lavender-rosin", name: "Lavender Rosin", brand: "Solventless Studio", strainType: "Indica Hybrid", bestTimeOfUse: "Evening.", description: "Rosin concentrate with relaxed and sleepy metadata.", priceCents: 54000, sizeLabel: "1 g", ratingAvg: 4.9, ratingCount: 44, thcValue: 69, thcUnit: "%", cbdValue: 0.6, cbdUnit: "%", terpeneTotalPct: 6.4, isLabTested: true, isOnSpecial: false, isNew: true, stockStatus: "in_stock", stockOnHand: 11, facetValues: { concentrateSubtype: "Rosin", ratioTag: "High THC" }, effects: [effect("sleepy", 86), effect("relaxed", 84)], terpenes: [terpene("linalool", "Linalool", 1.1, 1)], flavors: [flavor("floral", "Floral")] }
];

const extraNames = [
  ["flower", "Indoor", "Wedding Cake", "Emerald Room", "Hybrid", "relaxed"],
  ["flower", "Greenhouse", "Sour Diesel GH", "Highveld Herb", "Sativa", "energetic"],
  ["flower", "Outdoor", "Purple Punch Outdoor", "Night Garden", "Indica", "sleepy"],
  ["pre-rolls", "Pre-rolls", "Creative Kush Pre-roll", "Citrus Club", "Hybrid", "creative"],
  ["pre-rolls", "Multi-pack", "Relax Pack Minis", "Canopy Lane", "Indica Hybrid", "relaxed"],
  ["edibles", "Gummies", "Mango Micro Gummies", "Kind Kitchen", "", "euphoric"],
  ["edibles", "Beverages", "Focus Iced Tea", "Sip Society", "", "focused"],
  ["edibles", "Other Edibles", "Honey Citrus Lozenges", "Baked Table", "", "relaxed"],
  ["oils-supplements", "Oils / Tinctures", "Daylight CBD Oil", "WellLeaf", "", "focused"],
  ["oils-supplements", "Softgels / Capsules", "Evening Softgels", "WellLeaf", "", "sleepy"],
  ["vapes", "Cartridges", "Creative Kush Cart", "Cloud Craft", "Hybrid", "creative"],
  ["vapes", "Disposable Vapes", "Night Mint Disposable", "Cloud Craft", "Indica", "sleepy"],
  ["concentrates", "Wax", "Energetic Haze Wax", "Extract House", "Sativa", "energetic"],
  ["concentrates", "Live Resin", "Euphoria Live Resin", "Extract House", "Hybrid", "euphoric"],
  ["concentrates", "Rosin", "Calm Cake Rosin", "Solventless Studio", "Indica Hybrid", "relaxed"],
  ["edibles", "Chocolates", "Orange Square Chocolate", "Kind Kitchen", "", "creative"],
  ["vapes", "Battery Packs", "Slim Variable Battery", "Cloud Craft", "", "focused"],
  ["pre-rolls", "Infused Pre-rolls", "Berry Kief Infused Roll", "Canopy Lane", "Hybrid", "euphoric"]
] as const;

const generated = extraNames.map((entry, index): ProductSeed => {
  const [categorySlug, subcategorySlug, name, brand, strainType, primaryEffect] = entry;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const isEdibleOrAccessory = categorySlug === "edibles" || (categorySlug === "vapes" && subcategorySlug === "Battery Packs");
  return {
    categorySlug,
    subcategorySlug,
    slug,
    name,
    brand,
    strainType: strainType || undefined,
    growType: categorySlug === "flower" ? subcategorySlug : undefined,
    bestTimeOfUse: primaryEffect === "sleepy" || primaryEffect === "relaxed" ? "Evening." : "Daytime.",
    description: `${name} with ${primaryEffect} product tags for staff-assisted recommendation browsing.`,
    priceCents: 8500 + index * 1300,
    sizeLabel: isEdibleOrAccessory ? "Pack" : "1 g",
    ratingAvg: Number((4.1 + (index % 7) * 0.1).toFixed(1)),
    ratingCount: 28 + index * 9,
    thcValue: isEdibleOrAccessory ? (index % 4 === 0 ? 5 : 10) : 18 + (index % 9) * 3,
    thcUnit: isEdibleOrAccessory ? "mg" : "%",
    cbdValue: index % 5 === 0 ? 10 : 0.5,
    cbdUnit: isEdibleOrAccessory ? "mg" : "%",
    terpeneTotalPct: isEdibleOrAccessory ? 0 : 1.2 + (index % 6) * 0.7,
    isLabTested: index % 3 !== 0,
    isOnSpecial: index % 5 === 0,
    isNew: index % 4 === 0,
    stockStatus: index % 11 === 0 ? "out_of_stock" : index % 6 === 0 ? "low_stock" : "in_stock",
    stockOnHand: index % 11 === 0 ? 0 : 10 + index,
    facetValues: {
      dietary: categorySlug === "edibles" ? (index % 2 ? "Vegan" : "Gluten-free") : "",
      ratioTag: index % 4 === 0 ? "1:1" : categorySlug === "vapes" || categorySlug === "concentrates" ? "High THC" : "THC-forward",
      hardwareFacet: categorySlug === "vapes" ? (subcategorySlug === "Battery Packs" ? "510 thread" : "Rechargeable") : "",
      concentrateSubtype: categorySlug === "concentrates" ? subcategorySlug : ""
    },
    effects: [effect(primaryEffect, 82 + (index % 12)), effect("relaxed", primaryEffect === "relaxed" ? 88 : 42 + (index % 24)), effect("euphoric", primaryEffect === "euphoric" ? 86 : 38 + (index % 28))],
    terpenes: isEdibleOrAccessory ? [] : [terpene("limonene", "Limonene", 0.45 + index / 100, 1), terpene("myrcene", "Myrcene", 0.3 + index / 120, 2)],
    flavors: [flavor(index % 2 ? "citrus" : "berry", index % 2 ? "Citrus" : "Berry")]
  };
});

export const PRODUCTS: ProductDTO[] = [...seeds, ...generated].map((seed, index) => ({
  ...seed,
  id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  storeId: STORE.id,
  categoryName: categoryName(seed.categorySlug),
  images: productImages(seed.slug, seed.name),
  lineage: seed.lineage ?? []
}));
