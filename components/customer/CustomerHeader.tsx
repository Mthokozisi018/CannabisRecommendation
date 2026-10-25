import Link from "next/link";
import { ArrowLeft, Bell, Leaf, UserRound } from "lucide-react";

export function CustomerBrand() {
  return (
    <Link href="/customer/shop" className="inline-flex min-w-0 items-center gap-3" aria-label="GreenChoice Shop">
      <span className="grid size-11 shrink-0 place-items-center rounded-full border border-[#9cdc20] bg-[#071008] text-[#a9ec25]"><Leaf size={25} /></span>
      <span className="truncate text-xl font-black sm:text-2xl"><span className="text-[#a9ec25]">Green</span>Choice</span>
    </Link>
  );
}

export function CustomerHeader({ backHref, backLabel = "Go back", notifications = false }: { backHref?: string; backLabel?: string; notifications?: boolean }) {
  return (
    <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {backHref ? <Link href={backHref as never} aria-label={backLabel} className="grid size-11 shrink-0 place-items-center rounded-md border border-[#364238] bg-[#0b120d] text-white"><ArrowLeft size={22} /></Link> : null}
        <CustomerBrand />
      </div>
      <div className="flex shrink-0 items-center gap-2"><Link href="/customer/profile" aria-label="Account settings" className="grid size-11 place-items-center rounded-full border border-[#334137] bg-[#0a110c] text-[#dce2dc]"><UserRound size={21} /></Link>{notifications ? <Link href="/customer/alerts" aria-label="Alerts" className="grid size-11 shrink-0 place-items-center rounded-full border border-[#334137] bg-[#0a110c] text-[#dce2dc]"><Bell size={21} /></Link> : null}</div>
    </header>
  );
}
