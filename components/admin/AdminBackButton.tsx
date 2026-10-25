"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function AdminBackButton() {
  const pathname = usePathname().replace(/\/$/, "");
  const href = pathname === "/dashboard/admin"
    ? "/"
    : pathname.slice(0, pathname.lastIndexOf("/"));

  return (
    <nav aria-label="Back navigation" className="mx-auto max-w-[1500px] px-4 pt-6">
      <Link
        href={href as Route}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-lime-400/30 bg-black/40 px-4 text-sm font-semibold text-white shadow-[0_0_20px_rgba(115,215,70,0.12)] backdrop-blur-xl transition hover:border-lime-300/65 hover:text-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020805]"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Back
      </Link>
    </nav>
  );
}
