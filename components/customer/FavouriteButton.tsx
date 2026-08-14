"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";

export function FavouriteButton({ targetType, targetId, initiallySaved = false, className = "" }: { targetType: "store" | "product"; targetId: string; initiallySaved?: boolean; className?: string }) {
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();
  function toggle() {
    if (pending) return;
    startTransition(async () => {
      const response = await fetch("/api/customer/favourites", { method: "POST", cache: "no-store", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId }) });
      const result = await response.json().catch(() => ({})) as { saved?: boolean };
      if (response.ok && typeof result.saved === "boolean") setSaved(result.saved);
    });
  }
  return <button type="button" disabled={pending} onClick={toggle} aria-label={saved ? "Remove from saved" : "Save item"} aria-pressed={saved} className={`grid size-11 place-items-center rounded-full border-2 border-[#d8e1da] bg-white text-[#163021] shadow-sm transition hover:border-[#0b8a40] disabled:opacity-60 ${className}`}><Heart size={22} fill={saved ? "#0b8a40" : "none"} className={saved ? "text-[#0b8a40]" : ""} /></button>;
}

