import Link from "next/link";
import type { ReactNode } from "react";
import { Minus, Plus, Save, Trash2 } from "lucide-react";
import { saveCartAction, updateCartItemAction } from "@/app/actions";
import { getActiveCart } from "@/lib/dal/carts";
import { money } from "@/lib/services/format";

export async function DraftCart({ currencyCode = "ZAR" }: { currencyCode?: string }) {
  const cart = await getActiveCart().catch((error) => {
    if (error instanceof Error && error.message.includes("Persistent database configuration")) return null;
    throw error;
  });
  if (!cart) {
    return (
      <aside className="sticky top-20 rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100 shadow-glow" role="status">
        <h2 className="font-semibold">Draft cart unavailable</h2>
        <p className="mt-2">Persistent database configuration is required before production cart, import, or order workflows are enabled.</p>
      </aside>
    );
  }
  const total = cart.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);

  return (
    <aside className="sticky top-20 max-h-[calc(100vh-6rem)] rounded-lg border border-white/10 bg-panel/95 p-4 shadow-glow lg:overflow-auto" aria-live="polite">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Draft cart</h2>
          <p className="text-xs text-white/45">Store-scoped basket for staff review only</p>
        </div>
        <span className="rounded bg-white/10 px-2 py-1 text-xs">{cart.items.length}</span>
      </div>
      <div className="mt-4 space-y-3">
        {cart.items.length === 0 ? <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-white/50">Add recommendations from the grid.</p> : null}
        {cart.items.map((item) => (
          <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{item.product.name}</p>
                <p className="text-xs text-white/50">{money(item.unitPriceCents, currencyCode)}</p>
              </div>
              <form action={updateCartItemAction}>
                <input type="hidden" name="cartId" value={cart.id} />
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="quantity" value="0" />
                <button className="size-8 rounded bg-white/5 text-white/60 focus:outline focus:outline-2 focus:outline-mint" aria-label={`Remove ${item.product.name}`}>
                  <Trash2 className="mx-auto" size={15} />
                </button>
              </form>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center rounded-lg border border-white/10">
                <QuantityButton cartId={cart.id} itemId={item.id} quantity={item.quantity - 1} label="Decrease quantity"><Minus className="mx-auto" size={14} /></QuantityButton>
                <span className="w-8 text-center text-sm">{item.quantity}</span>
                <QuantityButton cartId={cart.id} itemId={item.id} quantity={item.quantity + 1} label="Increase quantity"><Plus className="mx-auto" size={14} /></QuantityButton>
              </div>
              <span className="text-sm font-semibold">{money(item.unitPriceCents * item.quantity, currencyCode)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/55">Draft total</span>
          <span className="font-semibold">{money(total, currencyCode)}</span>
        </div>
        <form action={saveCartAction} className="mt-3 space-y-3">
          <input type="hidden" name="cartId" value={cart.id} />
          <label className="block text-xs text-white/60">
            Review note
            <textarea name="note" maxLength={500} className="mt-1 min-h-20 w-full rounded-lg border border-white/10 bg-ink p-2 text-sm focus:outline focus:outline-2 focus:outline-mint" placeholder="Confirm customer preferences before saving." />
          </label>
          <button disabled={cart.items.length === 0} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-mint font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40">
            <Save size={17} /> Review and save cart
          </button>
        </form>
        {cart.status === "saved" ? <Link href={`/carts/${cart.id}`} className="mt-3 block rounded-lg border border-mint/30 px-3 py-2 text-center text-sm text-mint">Reopen saved cart</Link> : null}
      </div>
    </aside>
  );
}

function QuantityButton({ cartId, itemId, quantity, label, children }: { cartId: string; itemId: string; quantity: number; label: string; children: ReactNode }) {
  return (
    <form action={updateCartItemAction}>
      <input type="hidden" name="cartId" value={cartId} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="quantity" value={Math.max(0, Math.min(99, quantity))} />
      <button className="size-8 focus:outline focus:outline-2 focus:outline-mint" aria-label={label}>{children}</button>
    </form>
  );
}
