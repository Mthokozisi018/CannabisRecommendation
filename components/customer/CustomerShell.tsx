"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, ShoppingCart, Store, UserRound } from "lucide-react";
import { useCustomerCart } from "@/components/customer/CustomerCartProvider";

const navigation = [
  { href: "/customer", label: "Home", Icon: Home },
  { href: "/customer/stores", label: "Stores", Icon: Store },
  { href: "/customer/saved", label: "Saved", Icon: Heart },
  { href: "/customer/profile", label: "Profile", Icon: UserRound }
] as const;

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { cart } = useCustomerCart();
  const checkout = pathname === "/customer/checkout";

  return (
    <div className="customer-app min-h-screen bg-[#f7f8f6] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#101812]">
      {children}
      {!checkout ? (
        <Link href={"/customer/checkout" as never} aria-label={`Open checkout with ${cart.itemCount} items`} className="fixed bottom-28 right-5 z-[60] grid size-20 place-items-center rounded-full border-[3px] border-emerald-200 bg-[#043c24] text-white shadow-[0_16px_36px_rgba(4,60,36,0.38),0_0_24px_rgba(16,185,129,0.25)] transition hover:scale-105 hover:bg-[#07512f] active:scale-95 sm:right-8">
          <ShoppingCart size={30} strokeWidth={2.3} />
          {cart.itemCount > 0 ? <span className="absolute -right-1 -top-1 grid min-w-7 place-items-center rounded-full border-2 border-white bg-emerald-500 px-1 text-xs font-black leading-6 text-white">{cart.itemCount > 99 ? "99+" : cart.itemCount}</span> : null}
        </Link>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-[#dce3de] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(19,47,31,0.08)]" aria-label="Customer navigation">
        <div className="mx-auto grid h-20 max-w-2xl grid-cols-4">
          {navigation.map(({ href, label, Icon }) => {
            const active = href === "/customer" ? pathname === href : pathname.startsWith(href);
            return <Link key={href} href={href as never} className={`flex flex-col items-center justify-center gap-1 text-xs font-bold transition ${active ? "text-[#07823b]" : "text-[#405047] hover:text-[#07823b]"}`}><Icon size={25} strokeWidth={active ? 2.6 : 2} /><span>{label}</span></Link>;
          })}
        </div>
      </nav>
    </div>
  );
}
