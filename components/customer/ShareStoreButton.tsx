"use client";

import { Share2 } from "lucide-react";

export function ShareStoreButton({ storeName }: { storeName: string }) {
  async function share() {
    const data = { title: storeName, text: `Browse ${storeName} on GreenChoice`, url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else await navigator.clipboard.writeText(window.location.href).catch(() => undefined);
  }
  return <button type="button" onClick={() => void share()} className="grid size-12 place-items-center rounded-full border-2 border-white/55 bg-black/45 text-white backdrop-blur" aria-label="Share this store"><Share2 size={23} /></button>;
}

