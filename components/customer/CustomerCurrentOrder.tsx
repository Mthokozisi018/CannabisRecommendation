"use client";

import Link from "next/link";
import { Bike, Minus, Plus, ShoppingBag, Store, Trash2 } from "lucide-react";
import { useState } from "react";
import { useCustomerCart } from "@/components/customer/CustomerCartProvider";
import { CustomerImage } from "@/components/customer/CustomerImage";
import type { CustomerFulfillmentSettings } from "@/lib/customer/catalog";

const money = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
});

export function CustomerCurrentOrder({
  fulfillment,
}: {
  fulfillment: CustomerFulfillmentSettings | null;
}) {
  const { cart, busy, message, setQuantity, clearCart } = useCustomerCart();
  const collectionAvailable = fulfillment?.collectionEnabled ?? true;
  const deliveryAvailable = fulfillment?.deliveryEnabled ?? false;
  const [mode, setMode] = useState<"collection" | "delivery">(
    collectionAvailable ? "collection" : "delivery",
  );
  const fee =
    mode === "delivery"
      ? (fulfillment?.deliveryFee ?? 0)
      : (fulfillment?.collectionFee ?? 0);
  const minimum =
    mode === "delivery"
      ? (fulfillment?.deliveryMinimum ?? 0)
      : (fulfillment?.collectionMinimum ?? 0);
  const qualifies = (fulfillment?.ordersEnabled ?? true) && cart.subtotal >= minimum;

  if (!cart.items.length)
    return (
      <div className="border border-[#2c3830] bg-[#08100b] px-5 py-12 text-center">
        <ShoppingBag className="mx-auto text-[#a8e91d]" size={44} />
        <h2 className="mt-4 text-xl font-black">Your current order is empty</h2>
        <p className="mt-2 text-sm text-[#a9b3ab]">
          Choose a store and add available products to start an order.
        </p>
        <Link
          href="/customer/stores"
          className="mt-6 inline-flex h-11 items-center bg-[#a7e627] px-5 font-black text-[#081000]"
        >
          Browse stores
        </Link>
      </div>
    );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.7fr)]">
      <section className="border border-[#2c3830] bg-[#08100b]">
        <div className="flex items-center justify-between border-b border-[#27342b] px-4 py-4">
          <div>
            <p className="text-xs text-[#95a198]">Ordering from</p>
            <p className="mt-1 flex items-center gap-2 font-black">
              <Store size={17} className="text-[#a8e91d]" />
              {cart.storeName}
            </p>
          </div>
          <button
            onClick={() => void clearCart()}
            disabled={busy}
            className="grid size-10 place-items-center border border-[#6f3632] text-[#ff8f87]"
            aria-label="Clear current order"
          >
            <Trash2 size={18} />
          </button>
        </div>
        {message ? (
          <p className="border-b border-[#713c36] bg-[#22110f] p-3 text-sm text-[#ffaaa3]">
            {message}
          </p>
        ) : null}
        <ul className="divide-y divide-[#253129]">
          {cart.items.map((item) => (
            <li
              key={item.id}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 p-4"
            >
              <div className="relative aspect-square overflow-hidden bg-[#111812]">
                {item.imageUrl ? (
                    <CustomerImage
                      src={item.imageUrl}
                      alt={`${item.name} product`}
                      sizes="72px"
                      className="object-contain p-1"
                    />
                ) : (
                  <ShoppingBag className="m-auto size-full p-5 text-[#718076]" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-black">{item.name}</h2>
                <p className="mt-1 text-sm font-bold text-[#a8e91d]">
                  {money.format(item.unitPrice)}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center border border-[#39463c]">
                    <button
                      disabled={busy}
                      onClick={() =>
                        void setQuantity(item.id, item.quantity - 1)
                      }
                      className="grid size-9 place-items-center"
                      aria-label={`Remove one ${item.name}`}
                    >
                      {item.quantity === 1 ? (
                        <Trash2 size={15} />
                      ) : (
                        <Minus size={16} />
                      )}
                    </button>
                    <span className="grid h-9 min-w-9 place-items-center border-x border-[#39463c] font-bold">
                      {item.quantity}
                    </span>
                    <button
                      disabled={busy || item.quantity >= item.stockAvailable}
                      onClick={() =>
                        void setQuantity(item.id, item.quantity + 1)
                      }
                      className="grid size-9 place-items-center disabled:opacity-35"
                      aria-label={`Add one ${item.name}`}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <strong>
                    {money.format(item.unitPrice * item.quantity)}
                  </strong>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <aside className="h-fit border border-[#2c3830] bg-[#08100b] p-4">
        <h2 className="text-lg font-black">Fulfillment</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {collectionAvailable ? (
            <button
              onClick={() => setMode("collection")}
              className={`flex h-12 items-center justify-center gap-2 border font-bold ${mode === "collection" ? "border-[#a7e627] bg-[#a7e627] text-[#081000]" : "border-[#3a473d]"}`}
            >
              <ShoppingBag size={18} />
              Collection
            </button>
          ) : null}
          {deliveryAvailable ? (
            <button
              onClick={() => setMode("delivery")}
              className={`flex h-12 items-center justify-center gap-2 border font-bold ${mode === "delivery" ? "border-[#a7e627] bg-[#a7e627] text-[#081000]" : "border-[#3a473d]"}`}
            >
              <Bike size={19} />
              Delivery
            </button>
          ) : null}
        </div>
        <dl className="mt-5 grid gap-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#a2ada4]">Subtotal</dt>
            <dd>{money.format(cart.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#a2ada4]">
              {mode === "delivery" ? "Delivery fee" : "Collection fee"}
            </dt>
            <dd>{money.format(fee)}</dd>
          </div>
          <div className="flex justify-between border-t border-[#344138] pt-4 text-lg font-black">
            <dt>Total</dt>
            <dd className="text-[#a8e91d]">
              {money.format(cart.subtotal + fee)}
            </dd>
          </div>
        </dl>
        {!qualifies ? (
          <p className="mt-4 border border-[#725226] bg-[#241a0b] p-3 text-sm text-[#f0c778]">
            {fulfillment?.ordersEnabled === false
              ? "Online ordering is currently unavailable for this store."
              : `Add ${money.format(minimum - cart.subtotal)} more to meet the store minimum.`}
          </p>
        ) : null}
        <Link
          href={`/customer/checkout?fulfillment=${mode}`}
          aria-disabled={!qualifies}
          className={`mt-5 flex h-13 items-center justify-center font-black ${qualifies ? "bg-[#a7e627] text-[#081000]" : "pointer-events-none bg-[#293229] text-[#758078]"}`}
        >
          Proceed to checkout
        </Link>
      </aside>
    </div>
  );
}
