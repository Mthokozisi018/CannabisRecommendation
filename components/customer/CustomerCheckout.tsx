"use client";

import Link from "next/link";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCustomerCart } from "@/components/customer/CustomerCartProvider";

const money = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });

export function CustomerCheckout() {
  const { cart, busy, message, setQuantity, clearCart } = useCustomerCart();
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6 sm:px-6">
      <header className="flex items-center gap-4 border-b-2 border-[#dfe6e1] pb-5">
        <Link href={cart.storeId ? `/customer/stores/${cart.storeId}` as never : "/customer/stores"} className="grid size-11 place-items-center rounded-full border-2 border-[#cbd8cf] bg-white" aria-label="Back to products"><ArrowLeft size={22} /></Link>
        <div><p className="text-sm font-bold text-[#118544]">GreenChoice</p><h1 className="text-3xl font-black">Your checkout list</h1></div>
      </header>
      {message ? <p className="mt-5 rounded-xl border-2 border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{message}</p> : null}
      {cart.items.length === 0 ? (
        <section className="mt-10 rounded-3xl border-2 border-[#dce5df] bg-white p-10 text-center"><ShoppingBag className="mx-auto text-[#128646]" size={54} /><h2 className="mt-4 text-2xl font-black">Your list is empty</h2><p className="mt-2 text-[#65736a]">Add real products from a GreenChoice store to see them here.</p><Link href="/customer/stores" className="mt-6 inline-flex rounded-xl bg-[#087c39] px-6 py-3 font-black text-white">Browse stores</Link></section>
      ) : (
        <div className="mt-6 grid gap-5">
          <section className="overflow-hidden rounded-2xl border-2 border-[#dce5df] bg-white">
            <div className="border-b-2 border-[#e4eae6] px-5 py-4"><p className="text-sm font-bold text-[#68756d]">Store</p><p className="text-lg font-black">{cart.storeName}</p></div>
            <ul className="divide-y-2 divide-[#eef1ef]">
              {cart.items.map((item) => <li key={item.id} className="grid grid-cols-[1fr_auto] gap-4 p-5"><div><h2 className="font-black">{item.name}</h2><p className="mt-1 font-bold text-[#0b813b]">{money.format(item.unitPrice)} each</p><p className="mt-1 text-xs text-[#6a776e]">{item.stockAvailable} available</p></div><div className="flex items-center gap-2"><button disabled={busy} onClick={() => void setQuantity(item.id, item.quantity - 1)} className="grid size-10 place-items-center rounded-full border-2 border-[#ccd8d0]" aria-label={`Remove one ${item.name}`}>{item.quantity === 1 ? <Trash2 size={17} /> : <Minus size={17} />}</button><span className="min-w-8 text-center font-black">{item.quantity}</span><button disabled={busy || item.quantity >= item.stockAvailable} onClick={() => void setQuantity(item.id, item.quantity + 1)} className="grid size-10 place-items-center rounded-full border-2 border-[#ccd8d0] disabled:opacity-40" aria-label={`Add one ${item.name}`}><Plus size={17} /></button></div><p className="col-span-2 text-right text-lg font-black">{money.format(item.unitPrice * item.quantity)}</p></li>)}
            </ul>
          </section>
          <section className="rounded-2xl border-2 border-[#bedac7] bg-[#edf8f0] p-5"><div className="flex items-center justify-between"><span className="text-lg font-bold">Total</span><strong className="text-2xl text-[#087c39]">{money.format(cart.subtotal)}</strong></div><p className="mt-3 text-sm text-[#52645a]">This first version is a product list only. Payment, delivery and order placement have not been activated.</p></section>
          <button disabled={busy} onClick={() => void clearCart()} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-white font-black text-red-600"><Trash2 size={19} /> Clear list</button>
        </div>
      )}
    </main>
  );
}

