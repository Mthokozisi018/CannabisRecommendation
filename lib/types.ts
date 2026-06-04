export type AccountRole =
  | "guest"
  | "customer"
  | "employee_receptionist"
  | "employee_budtender"
  | "manager"
  | "compliance_officer"
  | "tenant_admin"
  | "owner"
  | "platform_super_admin";
export type StaffRole = "admin" | "receptionist" | "catalog_manager" | AccountRole;
export type ScopeType = "self" | "store" | "tenant" | "platform";
export type AccountState = "invited" | "pending_verification" | "active" | "suspended" | "locked" | "offboarded" | "erasure_requested" | "erased";
export type AgeVerificationStatus = "not_started" | "pending" | "verified_adult" | "failed" | "expired";
export type ProductRestrictionClass = "public_low_risk" | "adult_customer" | "staff_internal" | "compliance_internal" | "prescription_or_medical_review_required" | "hidden_until_enabled";
export type JurisdictionCode = "ZA";
export type Permission =
  | "brand.view"
  | "age_gate.complete"
  | "account.register"
  | "account.login"
  | "account.self.read"
  | "account.self.update"
  | "account.security.manage"
  | "privacy.manage_self"
  | "customer.history.self"
  | "customer.intake.store"
  | "customer.view.store"
  | "recommendation.start"
  | "appointments.manage.store"
  | "orders.support.store"
  | "catalog.view.store"
  | "inventory.view.store"
  | "inventory.manage.store"
  | "reports.view.store"
  | "reports.view.tenant"
  | "team.manage.frontline"
  | "team.manage.tenant"
  | "roles.manage.tenant"
  | "policy.manage.tenant"
  | "audit.view.tenant"
  | "consent.view.tenant"
  | "privacy.requests.manage"
  | "finance.view.tenant"
  | "settings.manage.tenant"
  | "exports.customer_data"
  | "platform.admin";

export type RoleAssignmentDTO = {
  role: AccountRole;
  scope: ScopeType;
  tenantId?: string;
  storeId?: string;
};

export type AccountContextDTO = {
  userId?: string;
  tenantId?: string;
  storeId?: string;
  jurisdiction: JurisdictionCode;
  ageVerificationStatus: AgeVerificationStatus;
  accountState: AccountState;
  consentVersionAccepted?: string;
  mfaEnabled?: boolean;
  assignments: RoleAssignmentDTO[];
};
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
  memberships?: StoreMembershipDTO[];
};

export type StoreMembershipDTO = {
  storeId: string;
  storeSlug?: string;
  storeName?: string;
  role: StaffRole;
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

export type AuditEventInput = {
  interactionId: string;
  actorId: string;
  tenantId: string;
  action: string;
  targetType: string;
  targetId?: string;
  result: "success" | "denied" | "validation_error" | "failure";
  metadata?: Record<string, unknown>;
};
