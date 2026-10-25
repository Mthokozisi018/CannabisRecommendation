export const customerNavigation = [
  { href: "/customer/shop", label: "Shop" },
  { href: "/customer/cart", label: "Cart" },
  { href: "/customer/orders", label: "Orders" },
  { href: "/customer/alerts", label: "Alerts" },
  { href: "/customer/addresses", label: "Addresses" },
] as const;

export function isCustomerNavigationActive(pathname: string, href: string) {
  if (href === "/customer/shop" && (pathname === "/customer" || pathname === "/customer/stores" || pathname.startsWith("/customer/stores/"))) return true;
  if (href === "/customer/cart" && pathname === "/customer/checkout") return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
