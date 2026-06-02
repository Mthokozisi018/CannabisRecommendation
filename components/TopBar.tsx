import Link from "next/link";
import { Search, Sprout, UserRound } from "lucide-react";
import { getCurrentStaff, getCurrentStore } from "@/lib/dal/auth";

export async function TopBar() {
  const [staff, store] = await Promise.all([getCurrentStaff(), getCurrentStore()]);
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/88 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3 font-semibold">
          <span className="grid size-10 place-items-center rounded-lg bg-mint text-ink"><Sprout size={22} /></span>
          <span className="hidden sm:block">GreenChoice</span>
        </Link>
        <label className="relative flex min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 text-white/45" size={18} />
          <input name="q" placeholder="Search product, brand, strain, flavor" className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.06] pl-10 pr-24 text-sm text-white placeholder:text-white/40" />
          <kbd className="absolute right-3 rounded border border-white/10 px-2 py-1 text-xs text-white/45">Ctrl K</kbd>
        </label>
        <div className="hidden rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70 md:block">{store.name}</div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
          <UserRound size={17} className="text-mint" />
          <span className="hidden lg:inline">{staff?.displayName ?? "Local staff"}</span>
        </div>
      </div>
    </header>
  );
}
