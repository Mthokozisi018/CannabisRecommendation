"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Save, Trash2 } from "lucide-react";
import type { ProductDTO } from "@/lib/types";
import { money } from "@/lib/services/format";

type DraftItem = {
  product: ProductDTO;
  quantity: number;
  note?: string;
};

const activeKey = "greenchoice.activeCart";
const savedPrefix = "greenchoice.savedCart.";

export function DraftCart({ currencyCode = "ZAR" }: { currencyCode?: string }) {
  const [items, setItems] = useState<DraftItem[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(activeKey);
    if (raw) setItems(JSON.parse(raw) as DraftItem[]);
    const onAdd = (event: Event) => {
      const product = (event as CustomEvent<ProductDTO>).detail;
      setItems((current) => {
        const existing = current.find((item) => item.product.id === product.id);
        const next = existing
          ? current.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
          : [...current, { product, quantity: 1 }];
        localStorage.setItem(activeKey, JSON.stringify(next));
        return next;
      });
    };
    window.addEventListener("greenchoice:add-to-cart", onAdd);
    return () => window.removeEventListener("greenchoice:add-to-cart", onAdd);
  }, []);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0), [items]);

  function setQuantity(productId: string, quantity: number) {
    const next = items.flatMap((item) => (item.product.id === productId ? (quantity <= 0 ? [] : [{ ...item, quantity }]) : [item]));
    setItems(next);
    localStorage.setItem(activeKey, JSON.stringify(next));
  }

  function saveCart() {
    const id = crypto.randomUUID();
    localStorage.setItem(savedPrefix + id, JSON.stringify({ id, status: "saved", items, total, savedAt: new Date().toISOString() }));
    setSavedId(id);
  }

  return (
    <aside className="sticky top-20 max-h-[calc(100vh-6rem)] rounded-lg border border-white/10 bg-panel/95 p-4 shadow-glow lg:overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Draft cart</h2>
          <p className="text-xs text-white/45">Saved basket for staff review only</p>
        </div>
        <span className="rounded bg-white/10 px-2 py-1 text-xs">{items.length}</span>
      </div>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-white/50">Add recommendations from the grid.</p> : null}
        {items.map((item) => (
          <div key={item.product.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{item.product.name}</p>
                <p className="text-xs text-white/50">{money(item.product.priceCents, currencyCode)}</p>
              </div>
              <button onClick={() => setQuantity(item.product.id, 0)} className="size-8 rounded bg-white/5 text-white/60" aria-label={`Remove ${item.product.name}`}>
                <Trash2 className="mx-auto" size={15} />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center rounded-lg border border-white/10">
                <button onClick={() => setQuantity(item.product.id, item.quantity - 1)} className="size-8" aria-label="Decrease quantity"><Minus className="mx-auto" size={14} /></button>
                <span className="w-8 text-center text-sm">{item.quantity}</span>
                <button onClick={() => setQuantity(item.product.id, item.quantity + 1)} className="size-8" aria-label="Increase quantity"><Plus className="mx-auto" size={14} /></button>
              </div>
              <span className="text-sm font-semibold">{money(item.product.priceCents * item.quantity, currencyCode)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/55">Draft total</span>
          <span className="font-semibold">{money(total, currencyCode)}</span>
        </div>
        <button onClick={saveCart} disabled={items.length === 0} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-mint font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40">
          <Save size={17} /> Save cart
        </button>
        {savedId ? <Link href={`/carts/${savedId}`} className="mt-3 block rounded-lg border border-mint/30 px-3 py-2 text-center text-sm text-mint">Reopen saved cart</Link> : null}
      </div>
    </aside>
  );
}
