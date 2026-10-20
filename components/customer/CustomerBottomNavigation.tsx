"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, MapPin, ShoppingBag, ShoppingCart, Store } from "lucide-react";
import { useCustomerCart } from "@/components/customer/CustomerCartProvider";
import { customerNavigation, isCustomerNavigationActive } from "@/lib/customer/navigation";

const icons = { Shop: Store, Cart: ShoppingCart, Orders: ShoppingBag, Alerts: Bell, Addresses: MapPin };

export function CustomerBottomNavigation() {
  const pathname = usePathname();
  const { cart } = useCustomerCart();
  return <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#253129] bg-[#050a07] pb-[env(safe-area-inset-bottom)]" aria-label="Customer navigation">
    <div className="mx-auto grid h-20 max-w-3xl grid-cols-5">
      {customerNavigation.map(({ href, label }) => {
        const active = isCustomerNavigationActive(pathname, href);
        const Icon = icons[label];
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-col items-center justify-center gap-1 border-t-2 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a8e91d] sm:text-xs ${active ? "border-[#a8e91d] bg-[#111d0a] text-[#a8e91d]" : "border-transparent text-[#c1c8c2] hover:text-white"}`}>
          <span className="relative"><Icon size={24} strokeWidth={active ? 2.5 : 1.8} />{label === "Cart" && cart.itemCount > 0 ? <span className="absolute -right-3 -top-2 min-w-5 rounded-full bg-[#a8e91d] px-1 text-center text-[10px] font-black leading-5 text-[#061000]" aria-label={`${cart.itemCount} items in cart`}>{cart.itemCount > 99 ? "99+" : cart.itemCount}</span> : null}</span>
          <span className="max-w-full truncate px-1">{label}</span>
        </Link>;
      })}
    </div>
  </nav>;
}
