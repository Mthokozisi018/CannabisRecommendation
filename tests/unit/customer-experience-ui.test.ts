import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getStoreOpenState } from "@/lib/customer/store-status";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("customer experience rebuild", () => {
  it("uses the exact persistent navigation order", () => {
    const shell = source("components/customer/CustomerBottomNavigation.tsx");
    const navigation = source("lib/customer/navigation.ts");
    const labels = ["Shop", "Cart", "Orders", "Alerts", "Addresses"];
    let previous = -1;
    for (const label of labels) {
      const index = navigation.indexOf(`label: "${label}"`);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
    expect(shell).toContain("fixed inset-x-0 bottom-0");
  });

  it("keeps Shop and retained Saved stores store-focused", () => {
    const home = source("app/customer/page.tsx");
    const saved = source("app/customer/saved/page.tsx");
    expect(home).toContain('redirect("/customer/shop")');
    expect(source("app/customer/shop/page.tsx")).toContain("listCustomerStores");
    expect(home).not.toContain("listCustomerProducts");
    expect(saved).toContain("Saved Stores");
    expect(saved).not.toContain("CustomerProductGrid");
  });

  it("uses the store coming-soon placeholder as a visual fallback only", () => {
    const imageComponent = source("components/customer/CustomerStoreImage.tsx");
    const card = source("components/customer/CustomerStoreCard.tsx");
    const storePage = source("app/customer/stores/[storeId]/page.tsx");
    const accountForms = source("components/account/AccountManagementForms.tsx");
    const action = source("app/dashboard/account-actions.ts");
    expect(imageComponent).toContain("STORE_IMAGE_PLACEHOLDER");
    expect(imageComponent).toContain("onError");
    expect(card).toContain("CustomerStoreImage");
    expect(storePage).not.toContain("CustomerStoreImage");
    expect(storePage).toContain("CustomerStoreCatalog");
    expect(accountForms).toContain('role === "manager"');
    expect(action).toContain("updateManagerStoreImageAction");
    expect(action).toContain("session.assignedStoreId");
    expect(action).toContain("store_image_url");
    expect(action).not.toContain("store-image-coming-soon.png");
  });

  it("loads customer store covers from store media without saving placeholders", () => {
    const catalog = source("lib/customer/catalog.ts");
    expect(catalog).toContain("store_image_url");
    expect(catalog).toContain("store_media(media_type,public_url,alt_text,sort_order)");
    expect(catalog).toContain('item.media_type === "cover"');
    expect(catalog).toContain("row.store_image_url ?? cover?.public_url ?? null");
    expect(catalog).not.toContain("STORE_IMAGE_PLACEHOLDER");
  });

  it("uses the customer wallpaper with the receptionist dashboard treatment", () => {
    const home = source("app/customer/page.tsx");
    const shell = source("components/customer/CustomerShell.tsx");
    const dashboard = source("components/GreenChoiceDashboard.tsx");
    const css = source("app/globals.css");
    expect(shell).toContain("customer-app");
    expect(home).not.toContain("customer-home-hero");
    expect(css).toContain("/images/customer-dashboard-wallpaper.png");
    expect(css).toContain("background-position: 64% center");
    expect(css).toContain("opacity: 0.62");
    expect(css).toContain("filter: saturate(1.25)");
    expect(css).toContain("linear-gradient(120deg, rgba(0, 0, 0, 0.48), rgba(0, 0, 0, 0.2))");
    expect(css).toContain("linear-gradient(180deg, rgba(2, 8, 7, 0.28), rgba(0, 0, 0, 0.55))");
    expect(dashboard).toContain('export { DashboardBackdrop } from "@/components/DashboardBackdrop"');
    expect(source("components/DashboardBackdrop.tsx")).toContain("opacity-62 saturate-125");
    expect(home).not.toContain("rgba(1,5,3,0.96)");
  });

  it("replaces the legacy Home landing page with Shop", () => {
    const home = source("app/customer/page.tsx");
    expect(home).not.toContain("Welcome back");
    expect(home).not.toContain("Find your GreenChoice store");
    expect(home).not.toContain('placeholder="Search stores"');
    expect(home).not.toContain("/customer/profile/addresses");
    expect(home).not.toContain("Pretoria, Gauteng");
    expect(home).toContain('redirect("/customer/shop")');
  });

  it("splits collection and delivery checkout fields and includes review", () => {
    const checkout = source("components/customer/CustomerCheckout.tsx");
    expect(checkout).toContain('step === "review"');
    expect(checkout).toContain("Review Order");
    expect(checkout).toContain("Delivery Address");
    expect(checkout).toMatch(/delivery\s*\?\s*\(\s*<>/);
    expect(checkout).toContain("idempotencyKey");
  });

  it("keeps store browsing instant and requests current location explicitly", () => {
    const catalog = source("components/customer/CustomerStoreCatalog.tsx");
    const grid = source("components/customer/CustomerProductGrid.tsx");
    const nearby = source("components/customer/CustomerNearbyStores.tsx");
    const config = source("next.config.ts");
    expect(catalog).toContain("FilterPanel");
    expect(catalog).toContain('visualStyle="receptionist"');
    expect(catalog).toContain("resolveProductSelection");
    expect(catalog).toContain("getCultivationOptions");
    expect(grid).toContain("ProductCard");
    expect(grid).toContain("addProduct(product.id, storeId)");
    expect(catalog).not.toContain('label: "All"');
    expect(nearby).toContain("navigator.geolocation.getCurrentPosition");
    expect(nearby).toContain('type="range"');
    expect(config).toContain("geolocation=(self)");
  });

  it("renders the customer Browse Store page as a POS-style browser without staff sale controls", () => {
    const storePage = source("app/customer/stores/[storeId]/page.tsx");
    const catalog = source("components/customer/CustomerStoreCatalog.tsx");
    const selectedStore = source("components/customer/SelectedStoreInfoBlock.tsx");
    expect(storePage).toContain("gc-pos-page");
    expect(storePage).toContain("gc-pos-header");
    expect(storePage).toContain('src="/branding/greenchoice-logo.png"');
    expect(storePage).toContain("<SelectedStoreInfoBlock store={store} />");
    expect(storePage.indexOf("<SelectedStoreInfoBlock store={store} />")).toBeLessThan(
      storePage.indexOf("categories.length"),
    );
    expect(storePage).not.toContain("<CustomerHeader");
    expect(storePage).not.toContain("FavouriteButton");
    expect(storePage).not.toContain("ShareStoreButton");
    expect(storePage).not.toContain("Fulfillment type");
    expect(storePage).not.toContain("Directions");
    expect(storePage).not.toContain("Opening hours");
    expect(selectedStore).toContain("You are shopping at");
    expect(selectedStore).toContain("store.name");
    expect(selectedStore).toContain("store.phoneNumber");
    expect(selectedStore).toContain("store.contactEmail");
    expect(selectedStore).toContain("getStoreOpenState(store.openingHours)");
    expect(selectedStore).toContain("getStoreTradingHoursLabel(store.openingHours)");
    expect(catalog).toContain("CustomerProductGrid");
    expect(catalog).not.toContain("CartPanel");
    expect(catalog).not.toContain("checkoutReceptionistSaleAction");
    expect(catalog).not.toContain("DashboardAccountPanel");
  });

  it("links customer store information to the manager Manage Store source fields", () => {
    const managerSettings = source("lib/manager/store-settings.ts");
    const managerValidation = source("lib/manager/store-settings-validation.ts");
    const managerAction = source("app/dashboard/manager/store/actions.ts");
    const catalog = source("lib/customer/catalog.ts");
    const selectedStore = source("components/customer/SelectedStoreInfoBlock.tsx");

    for (const field of [
      "name",
      "public_description",
      "store_contact_email",
      "store_phone_number",
      "physical_store_address",
      "city",
      "province",
      "postal_code",
      "opening_hours",
    ]) {
      expect(managerSettings).toContain(field);
      expect(catalog).toContain(field);
    }

    expect(managerValidation).toContain("publicDescription");
    expect(managerValidation).toContain("contactEmail");
    expect(managerValidation).toContain("openingHours");
    expect(managerAction).toContain("revalidatePath(`/customer/stores/${session.assignedStoreId}`)");
    expect(catalog).toContain("store_fulfillment_settings(orders_enabled,collection_enabled,delivery_enabled");
    expect(catalog).toContain("contactEmail: row.store_contact_email");
    expect(catalog).toContain("description: row.public_description");
    expect(selectedStore).toContain("store.contactEmail");
  });

  it("keeps customer store reads public, active-store scoped, and efficient", () => {
    const catalog = source("lib/customer/catalog.ts");
    const privateColumns = [
      "owner_user_id",
      "manager_user_id",
      "auth_user_id",
      "admin_notes",
      "internal_notes",
      "billing",
      "payout",
      "bank",
      "tax_number",
    ];

    expect(catalog).toContain('.eq("is_active", true).eq("store_access_status", "active")');
    expect(catalog).toContain('.in("id", ids)');
    expect(catalog).not.toContain("const stores = await listCustomerStores()");
    for (const column of privateColumns) expect(catalog).not.toContain(column);
  });

  it("keeps customer cart mutations scoped to the selected store inventory", () => {
    const provider = source("components/customer/CustomerCartProvider.tsx");
    const cartRoute = source("app/api/customer/cart/route.ts");
    const cart = source("lib/customer/cart.ts");
    const catalog = source("lib/customer/catalog.ts");
    const checkoutAction = source("app/customer/actions.ts");
    expect(provider).toContain("addProduct: (productId: string, storeId: string)");
    expect(cartRoute).toContain("storeId: z.string().uuid()");
    expect(cartRoute).toContain('.eq("product_id", parsed.data.productId)');
    expect(cartRoute).toContain('.eq("store_id", parsed.data.storeId)');
    expect(cartRoute).toContain("cart.storeId !== parsed.data.storeId");
    expect(cart).toContain('.eq("store_id", cart.store_id)');
    expect(catalog).toContain('.from("inventory_stock")');
    expect(catalog).toContain('.eq("store_id", input.storeId)');
    expect(checkoutAction).toContain("customer_checkout_cart_validation_failed");
    expect(checkoutAction).toContain("customer_checkout_schema_unavailable");
    expect(checkoutAction.indexOf("isMissingCheckoutSchemaError")).toBeLessThan(
      checkoutAction.indexOf("isCartValidationError(lower)"),
    );
  });

  it("keeps the Stores landing page in a single-column row layout", () => {
    const storesPage = source("app/customer/shop/page.tsx");
    const card = source("components/customer/CustomerStoreCard.tsx");
    expect(storesPage).toContain("grid grid-cols-1");
    expect(storesPage).not.toContain("lg:grid-cols-2");
    expect(storesPage).toContain("landingRow");
    expect(card).toContain("landingRow = false");
    expect(card).toContain("sm:grid-cols-[11rem_1fr]");
    expect(card).toContain('href={`/customer/stores/${store.id}`}');
    expect(card).toContain('targetType="store"');
    expect(card).toContain("initiallySaved={saved}");
    expect(card).toContain("justify-end");
  });

  it("uses the Receptionist dashboard logo treatment on the Stores landing page", () => {
    const storesPage = source("app/customer/shop/page.tsx");
    const receptionistPOS = source("components/receptionist/pos/ReceptionistPOS.tsx");
    const logoClass =
      "gc-pos-logo h-20 w-[min(30cm,calc(100vw-2rem))] object-contain sm:h-24 sm:w-[min(30cm,58vw)] lg:h-28";
    expect(storesPage).not.toContain(
      "Search active GreenChoice locations and their configured fulfillment",
    );
    expect(storesPage).toContain(">Shop</h1>");
    expect(storesPage).toContain('src="/branding/greenchoice-logo.png"');
    expect(storesPage).toContain("gc-pos-logo-wrap flex justify-center");
    expect(storesPage).toContain(logoClass);
    expect(storesPage).not.toContain('placeholder="Search by store name"');
    expect(storesPage).not.toContain("<CustomerNearbyStores");
    expect(storesPage).not.toContain("Use current location");
    expect(storesPage).not.toContain("default_radius_km");
    expect(receptionistPOS).toContain(logoClass);
  });

  it("shows real collection deadlines and store directions", () => {
    const confirmation = source(
      "app/customer/orders/[orderId]/confirmed/page.tsx",
    );
    expect(confirmation).toContain("Collect by");
    expect(confirmation).toContain("order.collectionExpiresAt");
    expect(confirmation).toContain("google.com/maps/dir");
    expect(confirmation).toContain("order.fulfillment.storeAddress");
  });

  it("derives opening state from configured hours", () => {
    const mondayMorning = new Date("2026-08-17T08:00:00.000Z");
    expect(getStoreOpenState({ monday: "09:00-17:00" }, mondayMorning)).toEqual(
      { open: true, label: "Open now" },
    );
    expect(
      getStoreOpenState(
        { monday: "09:00-17:00" },
        new Date("2026-08-17T18:00:00.000Z"),
      ),
    ).toEqual({ open: false, label: "Closed" });
    expect(
      getStoreOpenState(
        { monday: { closed: true } },
        mondayMorning,
      ),
    ).toEqual({ open: false, label: "Closed" });
    expect(
      getStoreOpenState(
        { monday: { open: "20:00", close: "02:00" } },
        new Date("2026-08-17T19:00:00.000Z"),
      ),
    ).toEqual({ open: true, label: "Open now" });
    expect(getStoreOpenState({}, mondayMorning)).toBeNull();
  });

  it("formats customer store trading hours from configured hours", async () => {
    const { getStoreTradingHoursLabel } = await import("@/lib/customer/store-status");
    const mondayMorning = new Date("2026-08-17T08:00:00.000Z");
    expect(getStoreTradingHoursLabel({ monday: "09:00-17:00" }, mondayMorning)).toBe("09:00 - 17:00");
    expect(getStoreTradingHoursLabel({ monday: { closed: true } }, mondayMorning)).toBe("Closed today");
    expect(getStoreTradingHoursLabel({ tuesday: ["10:00", "18:30"] }, mondayMorning)).toBe("Tuesday 10:00 - 18:30");
  });
});
