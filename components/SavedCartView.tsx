"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { money } from "@/lib/services/format";

type Saved = {
  id: string;
  savedAt: string;
  total: number;
  items: { product: { id: string; name: string; brand?: string; priceCents: number }; quantity: number }[];
};

export function SavedCartView({ id }: { id: string }) {
  const [cart, setCart] = useState<Saved | null | undefined>();
  useEffect(() => {
    const raw = localStorage.getItem(`greenchoice.savedCart.${id}`);
    setCart(raw ? JSON.parse(raw) as Saved : null);
  }, [id]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/browse" className="text-sm text-mint">Back to browse</Link>
      <section className="mt-5 rounded-lg border border-white/10 bg-panel p-6 shadow-glow">
        <h1 className="text-2xl font-semibold">Saved draft cart</h1>
        <p className="mt-1 text-sm text-white/50">{id}</p>
        {cart === undefined ? <p className="mt-6 text-white/50">Loading saved cart...</p> : null}
        {cart === null ? <p className="mt-6 rounded-lg border border-dashed border-white/10 p-4 text-white/50">No saved cart found in this browser.</p> : null}
        {cart ? (
          <div className="mt-6 space-y-3">
            {cart.items.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between rounded-lg bg-white/[0.04] p-3">
                <div>
                  <p className="font-medium">{item.product.name}</p>
                  <p className="text-sm text-white/50">{item.product.brand} · Qty {item.quantity}</p>
                </div>
                <p className="font-semibold">{money(item.product.priceCents * item.quantity)}</p>
              </div>
            ))}
            <div className="flex justify-between border-t border-white/10 pt-4">
              <span>Draft total</span>
              <span className="font-semibold">{money(cart.total)}</span>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
