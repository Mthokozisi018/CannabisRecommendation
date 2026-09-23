"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, ShoppingBag, ShoppingCart, Store, UserRound } from "lucide-react";
import { useCustomerCart } from "@/components/customer/CustomerCartProvider";

const navigation = [
  { href: "/customer", label: "Home", Icon: Home },
  { href: "/customer/stores", label: "Stores", Icon: Store },
  { href: "/customer/saved", label: "Saved", Icon: Heart },
  { href: "/customer/orders", label: "Orders", Icon: ShoppingBag },
  { href: "/customer/profile", label: "Profile", Icon: UserRound }
] as const;

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { cart } = useCustomerCart();
  const browsingStore = /^\/customer\/stores\/[^/]+$/.test(pathname);

  return (
    <div className="customer-app min-h-screen overflow-x-clip pb-[calc(6.5rem+env(safe-area-inset-bottom))] text-[#f6f8f4]">
      {children}
      {browsingStore && cart.itemCount > 0 ? (
        <Link href="/customer/orders" aria-label={`Open current order with ${cart.itemCount} items`} className="fixed bottom-24 right-4 z-[60] grid size-16 place-items-center rounded-full border border-[#a7ed25] bg-[#12210b] text-[#b6f52d] shadow-[0_10px_30px_rgba(0,0,0,0.55)] transition hover:bg-[#1c3210] active:scale-95 sm:right-8">
          <ShoppingCart size={27} />
          <span className="absolute -right-1 -top-1 grid min-w-6 place-items-center rounded-full bg-[#a8e91d] px-1 text-xs font-black leading-6 text-[#061000]">{cart.itemCount > 99 ? "99+" : cart.itemCount}</span>
        </Link>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#253129] bg-[#050a07] pb-[env(safe-area-inset-bottom)]" aria-label="Customer navigation">
        <div className="mx-auto grid h-20 max-w-3xl grid-cols-5">
          {navigation.map(({ href, label, Icon }) => {
            const active = href === "/customer" ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition sm:text-xs ${active ? "text-[#a8e91d]" : "text-[#c1c8c2] hover:text-white"}`}>
                <Icon size={24} strokeWidth={active ? 2.5 : 1.8} fill={active && label === "Saved" ? "currentColor" : "none"} />
                <span className="max-w-full truncate px-1">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
