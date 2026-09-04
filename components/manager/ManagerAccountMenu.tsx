import Link from "next/link";
import { ChevronDown, Crown, LogOut, Store, UserRound } from "lucide-react";
import { logoutGreenChoiceStaffAction } from "@/app/actions";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "M") + (parts[1]?.[0] ?? "");
}

export function ManagerAccountMenu({ managerName, storeName }: { managerName: string; storeName: string }) {
  return (
    <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
      <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl border border-white/16 bg-[#07100c] px-3 py-2.5 text-white shadow-[0_18px_50px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition hover:border-[#68ed62]/45 focus-visible:ring-2 focus-visible:ring-[#68ed62]/70 [&::-webkit-details-marker]:hidden">
          <span className="hidden min-w-0 text-right sm:block">
            <span className="block max-w-[190px] truncate text-sm font-extrabold">{storeName}</span>
            <span className="block text-xs font-semibold text-white/55">Manager</span>
          </span>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#35d95f] text-sm font-black text-[#031007] shadow-[0_0_26px_rgba(53,217,95,0.3)]">
            {initials(managerName).toUpperCase()}
          </span>
          <ChevronDown aria-hidden="true" size={18} className="text-white/72 transition group-open:rotate-180" />
        </summary>

        <div className="absolute right-0 mt-2 w-[290px] overflow-hidden rounded-2xl border border-white/14 bg-[#09110e] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <Link href="/manager/subscription" prefetch={false} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold text-white transition hover:bg-[#12351e] hover:text-[#7af06c]">
            <Crown aria-hidden="true" size={20} className="text-[#f4cf45]" />
            <span>Manage Subscription</span>
          </Link>
          <Link href="/dashboard/manager/store" prefetch={false} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold text-white transition hover:bg-[#12351e] hover:text-[#7af06c]">
            <Store aria-hidden="true" size={20} />
            <span>Manage Store</span>
          </Link>
          <Link href="/dashboard/manager/account" prefetch={false} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold text-white transition hover:bg-[#12351e] hover:text-[#7af06c]">
            <UserRound aria-hidden="true" size={20} />
            <span>Manage Account</span>
          </Link>
          <div className="my-1 h-px bg-white/10" />
          <form action={logoutGreenChoiceStaffAction}>
            <button type="submit" className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold text-white transition hover:bg-[#2a1212] hover:text-red-200">
              <LogOut aria-hidden="true" size={20} />
              <span>Log out</span>
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
