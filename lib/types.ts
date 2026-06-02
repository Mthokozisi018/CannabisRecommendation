export type StaffRole = "admin" | "receptionist" | "catalog_manager";
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export type StoreDTO = {
  id: string;
  slug: string;
  name: string;
  currencyCode: string;
  timezone: string;
};

export type StaffDTO = {
  id: string;
  displayName: string;
  email: string;
  role: StaffRole;
  storeId: string;
};

export type CategoryDTO = {
  id: string;
  slug: string;
  name: string;
  icon?: string;
  parentId?: string | null;
  subcategories: string[];
  sortOrder: number;
};

export type CategoryWithCountDTO = CategoryDTO & { count: number };

export type EffectDTO = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon?: string;
  sortOrder: number;
};

export type ProductDTO = {
  id: string;
  storeId: string;
  categorySlug: string;
  categoryName: string;
  subcategorySlug: string;
  slug: string;
  name: string;
  brand?: string;
  strainType?: string;
  growType?: string;
  geneticsSummary?: string;
  bestTimeOfUse?: string;
  description: string;
  priceCents: number;
  sizeLabel?: string;
  ratingAvg?: number;
  ratingCount?: number;
  thcValue?: number;
  thcUnit?: string;
  cbdValue?: number;
  cbdUnit?: string;
  terpeneTotalPct?: number;
  isLabTested: boolean;
  isOnSpecial: boolean;
  isNew: boolean;
  stockStatus: StockStatus;
  stockOnHand: number;
  facetValues: Record<string, string | string[] | number | boolean>;
  images: { storagePath: string; altText: string; isPrimary?: boolean }[];
  effects: { slug: string; name: string; scorePct: number }[];
  terpenes: { slug: string; name: string; description?: string; pct?: number; rankOrder?: number }[];
  flavors: { slug: string; name: string }[];
  lineage: { slug: string; name: string; relationType: string }[];
};

export type ProductMatchDTO = ProductDTO & {
  matchPct: number;
  scoreBreakdown: {
    effect: number;
    terpene: number;
    range: number;
    rating: number;
    stockFreshness: number;
  };
};

export type ProductFilters = {
  query?: string;
  category?: string;
  subcategory?: string;
  strainType?: string;
  growType?: string;
  brand?: string;
  inStockOnly?: boolean;
  thcMin?: number;
  thcMax?: number;
  cbdMin?: number;
  cbdMax?: number;
  priceMin?: number;
  priceMax?: number;
  dietary?: string;
  ratioTag?: string;
  hardwareFacet?: string;
  concentrateSubtype?: string;
  view?: "grid" | "list";
};

export type CartItemDTO = {
  id: string;
  product: ProductDTO;
  quantity: number;
  unitPriceCents: number;
  note?: string;
};

export type CartDTO = {
  id: string;
  storeId: string;
  recommendationSessionId?: string;
  status: "draft" | "saved";
  note?: string;
  items: CartItemDTO[];
  createdAt: string;
  updatedAt: string;
};
