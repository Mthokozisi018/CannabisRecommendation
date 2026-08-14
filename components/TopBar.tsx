import Link from "next/link";
import { headers } from "next/headers";
import { Menu, Sprout, UserRound } from "lucide-react";
import { switchStoreAction } from "@/app/actions";
import { getCurrentStaff, getCurrentStore } from "@/lib/dal/auth";
import { staffToAccountContext } from "@/lib/authorization";
import { visibleNavItems } from "@/lib/account-data";

function shouldRenderGlobalTopBar(pathname: string) {
  return pathname !== "/login" && !pathname.startsWith("/customer") && !pathname.startsWith("/auth/") && !pathname.startsWith("/dashboard/manager") && !pathname.startsWith("/dashboard/receptionist");
}

export async function TopBar() {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-greenchoice-pathname") ?? "";
  if (pathname && !shouldRenderGlobalTopBar(pathname)) return null;

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
        <div className="min-w-0 flex-1" />
        <form action={switchStoreAction} className="hidden items-center gap-2 rounded-lg border border-mint/25 bg-mint/10 px-3 py-2 text-sm text-mint md:flex">
          <span className="font-semibold">Active store</span>
          {staff?.memberships && staff.memberships.length > 1 ? (
            <select name="storeId" defaultValue={store.id} className="rounded border border-white/10 bg-ink px-2 py-1 text-[#72d943] focus:outline focus:outline-2 focus:outline-mint" aria-label="Switch active store">
              {staff.memberships.map((membership) => <option key={membership.storeId} value={membership.storeId}>{membership.storeName ?? membership.storeId}</option>)}
            </select>
          ) : (
            <span className="text-[#72d943]">{store.name}</span>
          )}
          {staff?.memberships && staff.memberships.length > 1 ? <button className="rounded bg-mint px-2 py-1 text-xs font-semibold text-ink">Switch</button> : null}
        </form>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
          <UserRound size={17} className="text-mint" />
          <span className="hidden text-[#72d943] lg:inline">{staff?.displayName ?? "Local staff"}</span>
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
