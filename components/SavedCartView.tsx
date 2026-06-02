import Link from "next/link";
import { getSavedCart } from "@/lib/dal/carts";
import { getCurrentStore } from "@/lib/dal/auth";
import { money } from "@/lib/services/format";

export async function SavedCartView({ id }: { id: string }) {
  const [cart, store] = await Promise.all([getSavedCart(id), getCurrentStore()]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/browse" className="text-sm text-mint">Back to browse</Link>
      <section className="mt-5 rounded-lg border border-white/10 bg-panel p-6 shadow-glow">
        <h1 className="text-2xl font-semibold">Saved draft cart</h1>
        <p className="mt-1 text-sm text-white/50">{id}</p>
        {!cart ? <p className="mt-6 rounded-lg border border-dashed border-white/10 p-4 text-white/50">No saved cart found for the active store.</p> : null}
        {cart ? (
          <div className="mt-6 space-y-3">
            <div className="rounded-lg border border-mint/20 bg-mint/10 p-3 text-sm text-mint">Review complete. This is a saved recommendation draft, not a payment or order.</div>
            {cart.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-white/[0.04] p-3">
                <div>
                  <p className="font-medium">{item.product.name}</p>
                  <p className="text-sm text-white/50">{item.product.brand} - Qty {item.quantity}</p>
                </div>
                <p className="font-semibold">{money(item.unitPriceCents * item.quantity, store.currencyCode)}</p>
              </div>
            ))}
            <div className="flex justify-between border-t border-white/10 pt-4">
              <span>Draft total</span>
              <span className="font-semibold">{money(cart.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0), store.currencyCode)}</span>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
