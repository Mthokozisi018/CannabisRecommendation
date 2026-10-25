import { describe, expect, it } from "vitest";
import { customerNavigation, isCustomerNavigationActive } from "@/lib/customer/navigation";

describe("customer navigation", () => {
  it("has exactly the five primary destinations", () => {
    expect(customerNavigation.map((item) => item.label)).toEqual(["Shop", "Cart", "Orders", "Alerts", "Addresses"]);
  });
  it.each([
    ["/customer/shop", "Shop"], ["/customer/stores/store-id", "Shop"],
    ["/customer/cart", "Cart"], ["/customer/checkout", "Cart"],
    ["/customer/orders/order-id/confirmed", "Orders"],
    ["/customer/alerts", "Alerts"], ["/customer/addresses", "Addresses"],
  ])("selects one tab for %s", (pathname, label) => {
    expect(customerNavigation.filter((item) => isCustomerNavigationActive(pathname, item.href)).map((item) => item.label)).toEqual([label]);
  });
  it("does not match unrelated prefixes or reintroduce secondary account areas", () => {
    for (const pathname of ["/customer/orders-other", "/customer/profile", "/customer/saved"]) expect(customerNavigation.filter((item) => isCustomerNavigationActive(pathname, item.href))).toEqual([]);
  });
});
