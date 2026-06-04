import Link from "next/link";
import { Menu, Search, Sprout, UserRound } from "lucide-react";
import { switchStoreAction } from "@/app/actions";
import { getCurrentStaff, getCurrentStore } from "@/lib/dal/auth";
import { staffToAccountContext } from "@/lib/authorization";
import { visibleNavItems } from "@/lib/account-data";

export async function TopBar() {
  const [staff, store] = await Promise.all([getCurrentStaff(), getCurrentStore()]);
  const nav = staff ? visibleNavItems(staffToAccountContext(staff)).slice(0, 6) : [];
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/88 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3">
        <Link href="/" className="flex min-w-fit items-center gap-3 font-semibold">
          <span className="grid size-10 place-items-center text-mint"><Sprout size={34} strokeWidth={1.5} /></span>
          <span className="hidden leading-tight sm:block"><span className="text-mint">Green</span>Choice<span className="block text-xs font-normal text-white/65">Dispensary System</span></span>
        </Link>
        <button className="grid size-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04]" aria-label="Open navigation"><Menu size={20} /></button>
        <label className="relative flex min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 text-white/45" size={18} />
          <input name="q" placeholder="Search product, brand, strain, flavor" className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.06] pl-10 pr-24 text-sm text-white placeholder:text-white/40" />
          <kbd className="absolute right-3 rounded border border-white/10 px-2 py-1 text-xs text-white/45">Ctrl K</kbd>
        </label>
        <form action={switchStoreAction} className="hidden items-center gap-2 rounded-lg border border-mint/25 bg-mint/10 px-3 py-2 text-sm text-mint md:flex">
          <span className="font-semibold">Active store</span>
          {staff?.memberships && staff.memberships.length > 1 ? (
            <select name="storeId" defaultValue={store.id} className="rounded border border-white/10 bg-ink px-2 py-1 text-white focus:outline focus:outline-2 focus:outline-mint" aria-label="Switch active store">
              {staff.memberships.map((membership) => <option key={membership.storeId} value={membership.storeId}>{membership.storeName ?? membership.storeId}</option>)}
            </select>
          ) : (
            <span>{store.name}</span>
          )}
          {staff?.memberships && staff.memberships.length > 1 ? <button className="rounded bg-mint px-2 py-1 text-xs font-semibold text-ink">Switch</button> : null}
        </form>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
          <UserRound size={17} className="text-mint" />
          <span className="hidden lg:inline">{staff?.displayName ?? "Local staff"}</span>
        </div>
      </div>
      {nav.length ? (
        <nav className="mx-auto hidden max-w-[1600px] gap-2 px-4 pb-3 lg:flex" aria-label="Role-aware navigation">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={`${item.href}-${item.label}`} href={item.href as never} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-white/72 transition hover:border-mint/40 hover:text-mint">
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
