"use client";

import { CreditCard, Minus, Plus, Trash2, XCircle } from "lucide-react";
import { Money } from "@/components/GreenChoiceDashboard";
import type { CartItem } from "@/components/receptionist/pos/pos-types";

export function CartPanel({
  cart,
  subtotal,
  cartCount,
  isPending,
  onClearCart,
  onChangeQuantity,
  onRemoveItem,
  onCheckout
}: {
  cart: CartItem[];
  subtotal: number;
  cartCount: number;
  isPending: boolean;
  onClearCart: () => void;
  onChangeQuantity: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
}) {
  return (
    <aside className="flex w-full max-h-[calc(100vh-130px)] flex-col rounded-xl border-2 border-white/45 bg-[linear-gradient(160deg,#101714,#07100c_52%,#030806)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] xl:max-h-[760px]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">Current Sale</h2>
        <button disabled={cart.length === 0 || isPending} onClick={onClearCart} className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 text-white/75 transition hover:border-red-200/45 hover:text-red-100 disabled:opacity-35" aria-label="Clear cart">
          <Trash2 size={17} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {cart.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/35 bg-[#050b08] p-4 text-sm leading-6 text-white/58">Cart is empty. Add products to prepare a sale.</p>
        ) : (
          cart.map((item) => (
            <div key={item.productId} className="border-b border-white/10 py-4">
              <div className="flex gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/25">
                  {/* Product images can be Supabase URLs or local placeholders. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageSrc} alt={`${item.name} cart image`} className="size-full object-contain p-1" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-3">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p className="shrink-0"><Money value={item.unitPrice * item.quantity} /></p>
                  </div>
                  <p className="mt-1 text-sm text-white/68">{item.sizeLabel || item.subcategory}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <button onClick={() => onRemoveItem(item.productId)} className="text-xs text-white/50 hover:text-red-200">Remove</button>
                    <div className="flex h-8 items-center rounded-lg border border-white/12 bg-black/20">
                      <button onClick={() => onChangeQuantity(item.productId, -1)} className="grid size-8 place-items-center" aria-label={`Decrease ${item.name}`}>
                        <Minus size={15} />
                      </button>
                      <span className="min-w-9 text-center font-bold">{item.quantity}</span>
                      <button onClick={() => onChangeQuantity(item.productId, 1)} className="grid size-8 place-items-center" aria-label={`Increase ${item.name}`}>
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
        <p className="flex items-center justify-between gap-4 text-sm">
          <span className="text-white/72">Subtotal</span>
          <span className="shrink-0 font-semibold text-white"><Money value={subtotal} /></span>
        </p>
        <p className="flex items-center justify-between gap-4 text-sm">
          <span className="text-white/72">Tax (Included)</span>
          <span className="shrink-0 font-semibold text-white/86"><Money value={0} /></span>
        </p>
        <p className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
          <span className="text-lg font-extrabold text-white">Total</span>
          <span className="shrink-0 text-2xl font-extrabold text-emerald-400"><Money value={subtotal} /></span>
        </p>
      </div>

      <div className="mt-5 grid gap-2">
        <button disabled={cart.length === 0 || isPending} onClick={onClearCart} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/18 font-semibold text-white transition hover:border-red-200/45 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-45">
          <XCircle size={18} /> Cancel Sale
        </button>
        <button disabled={cart.length === 0 || isPending} onClick={onCheckout} className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-emerald-500 font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40">
          <CreditCard size={19} /> {isPending ? "Processing..." : `Checkout${cartCount ? ` (${cartCount})` : ""}`}
        </button>
      </div>
    </aside>
  );
}
