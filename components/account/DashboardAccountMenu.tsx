"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { LogOut, UserRound } from "lucide-react";
import { logoutOwnAccountAction } from "@/app/dashboard/account-actions";
import { accountFirstName, accountRoleTitle, type AccountRole, type DashboardAccountProfile } from "@/components/account/account-types";

type DashboardAccountMenuProps = {
  role: AccountRole;
  profile: DashboardAccountProfile;
  manageHref?: string;
  className?: string;
};

export function DashboardAccountMenu({ role, profile, manageHref = "/dashboard/account", className = "" }: DashboardAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [loggingOut, startLogout] = useTransition();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const title = accountRoleTitle(role);
  const name = accountFirstName(profile);

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) closeMenu();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, open]);

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="dashboard-account-menu"
        className={`inline-flex h-10 max-w-[180px] items-center justify-center gap-2 rounded-lg border border-[#36d179] bg-[#04100a] px-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(0,0,0,0.34)] transition hover:border-[#7cf0aa] hover:bg-[#07180f] hover:text-[#d9ffe6] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#9bf2b5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020503] sm:h-11 sm:px-4 ${className}`}
      >
        <UserRound size={17} aria-hidden="true" className="shrink-0 text-[#8df2b1]" />
        <span className="truncate">{name}</span>
      </button>

      {open ? (
        <div id="dashboard-account-menu" role="menu" className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-56 rounded-lg border border-[#36d179] bg-[#031008] p-3 text-white shadow-[0_20px_46px_rgba(0,0,0,0.62)]">
          <div className="border-b border-[#296646] pb-3">
            <p className="text-xs font-black uppercase tracking-normal text-[#8df2b1]">{title} Account</p>
            <p className="mt-1 truncate text-base font-black text-white">{name}</p>
          </div>
          <div className="grid gap-2 py-3">
            <Link href={manageHref as never} role="menuitem" onClick={closeMenu} className="inline-flex h-10 items-center rounded-md border border-[#296646] bg-[#07130d] px-3 text-sm font-black text-white transition hover:border-[#7cf0aa] hover:bg-[#0b1c13] focus-visible:ring-2 focus-visible:ring-[#9bf2b5]">
              Manage Account
            </Link>
          </div>
          <button
            type="button"
            role="menuitem"
            disabled={loggingOut}
            onClick={() => {
              if (!window.confirm("Log out of GreenChoice now?")) return;
              startLogout(async () => {
                await logoutOwnAccountAction();
              });
            }}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#b84242] bg-[#260707] px-3 text-sm font-black text-[#ffd7d7] transition hover:border-[#f07878] hover:bg-[#3a0a0a] disabled:opacity-60"
          >
            <LogOut size={17} aria-hidden="true" />
            {loggingOut ? "Logging out..." : "Log Out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function DashboardAccountPanel(props: DashboardAccountMenuProps) {
  return <DashboardAccountMenu {...props} />;
}
