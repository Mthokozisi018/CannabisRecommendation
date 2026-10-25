"use client";

import Link from "next/link";
import {
  Check,
  CreditCard,
  LockKeyhole,
  MapPin,
  Pencil,
  ShoppingBag,
  Truck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { placeCustomerOrderAction } from "@/app/customer/actions";
import { useCustomerCart } from "@/components/customer/CustomerCartProvider";
import { CustomerImage } from "@/components/customer/CustomerImage";
import type { CustomerStore } from "@/lib/customer/catalog";

const money = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
});
type Details = {
  firstName: string;
  surname: string;
  phoneNumber: string;
  addressLine: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  deliveryInstructions: string;
  saveAddress: boolean;
};

export function CustomerCheckout({
  store,
  fulfillmentType,
  initialDetails,
}: {
  store: CustomerStore;
  fulfillmentType: "collection" | "delivery";
  initialDetails: Details;
}) {
  const { cart } = useCustomerCart();
  const [step, setStep] = useState<"details" | "review">("details");
  const [details, setDetails] = useState(initialDetails);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash">("card");
  const [message, setMessage] = useState("");
  const [placing, startPlacing] = useTransition();
  const idempotencyKey = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const delivery = fulfillmentType === "delivery";
  const fee = delivery
    ? store.fulfillment.deliveryFee
    : store.fulfillment.collectionFee;
  const total = cart.subtotal + fee;

  function field<K extends keyof Details>(key: K, value: Details[K]) {
    setDetails((current) => ({ ...current, [key]: value }));
  }
  function continueToReview(event: React.FormEvent) {
    event.preventDefault();
    if (formRef.current?.reportValidity()) {
      setMessage("");
      setStep("review");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  function placeOrder() {
    idempotencyKey.current ??= window.crypto.randomUUID();
    setMessage("");
    startPlacing(async () => {
      const result = await placeCustomerOrderAction({
        fulfillmentType,
        paymentMethod,
        customerDetails: details,
        idempotencyKey: idempotencyKey.current,
      });
      if (!result.ok || !result.orderId) {
        setMessage(result.message);
        return;
      }
      window.location.assign(`/customer/orders/${result.orderId}/confirmed`);
    });
  }

  if (!cart.items.length)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <ShoppingBag className="mx-auto text-[#a8e91d]" size={46} />
        <h1 className="mt-4 text-2xl font-black">
          Your current order is empty
        </h1>
        <Link
          href="/customer/shop"
          className="mt-6 inline-flex h-11 items-center bg-[#a7e627] px-5 font-black text-[#081000]"
        >
          Browse stores
        </Link>
      </div>
    );

  return (
    <main className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
      <div className="grid grid-cols-4 gap-1 border border-[#2f3b33] bg-[#08100b] p-3 text-center text-[10px] sm:text-sm">
        {[
          ["Cart", ShoppingBag, true],
          ["Your Details", UserRound, true],
          ["Review Order", CreditCard, step === "review"],
          ["Confirmed", Check, false],
        ].map(([label, Icon, active]) => {
          const StepIcon = Icon as typeof ShoppingBag;
          return (
            <div
              key={label as string}
              className={`flex min-w-0 flex-col items-center gap-2 py-2 ${active ? "text-[#a8e91d]" : "text-[#7d8980]"}`}
            >
              <span
                className={`grid size-9 place-items-center rounded-full border ${active ? "border-[#a8e91d] bg-[#142208]" : "border-[#445047]"}`}
              >
                <StepIcon size={17} />
              </span>
              <span className="truncate">{label as string}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-7">
        <h1 className="text-3xl font-black sm:text-4xl">
          {step === "review"
            ? "Review Order"
            : `Checkout (${delivery ? "Delivery" : "Collection"})`}
        </h1>
        <p className="mt-2 text-[#a7b1a9]">
          {step === "review"
            ? "Check every detail before placing your order."
            : `Provide the details required for ${fulfillmentType}.`}
        </p>
      </div>
      <section className="mt-5 flex items-start gap-3 border border-[#2e3a32] bg-[#09110c] p-4">
        <span className="grid size-11 shrink-0 place-items-center border border-[#587421] text-[#a8e91d]">
          {delivery ? <Truck size={22} /> : <ShoppingBag size={21} />}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#a8e91d]">
            {delivery ? "Delivery store" : "Collection store"}
          </p>
          <p className="mt-1 truncate font-black">{store.name}</p>
          <p className="mt-1 text-sm text-[#aab4ac]">
            {[store.address, store.city, store.province, store.postalCode]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
      </section>
      {message ? (
        <p
          role="alert"
          className="mt-5 border border-[#7c3933] bg-[#25100e] p-4 text-sm font-bold text-[#ffaaa2]"
        >
          {message}
        </p>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
        {step === "details" ? (
          <form
            ref={formRef}
            onSubmit={continueToReview}
            className="border border-[#2e3a32] bg-[#08100b] p-5"
          >
            <h2 className="text-xl font-black">Your Details</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Name
                <input
                  required
                  value={details.firstName}
                  onChange={(event) => field("firstName", event.target.value)}
                  className="mt-2 h-12 w-full border border-[#3b483f] bg-[#020604] px-3 outline-none focus:border-[#a8e91d]"
                />
              </label>
              <label className="text-sm font-bold">
                Surname
                <input
                  required
                  value={details.surname}
                  onChange={(event) => field("surname", event.target.value)}
                  className="mt-2 h-12 w-full border border-[#3b483f] bg-[#020604] px-3 outline-none focus:border-[#a8e91d]"
                />
              </label>
              <label className="text-sm font-bold sm:col-span-2">
                Phone Number
                <input
                  required
                  inputMode="tel"
                  value={details.phoneNumber}
                  onChange={(event) => field("phoneNumber", event.target.value)}
                  className="mt-2 h-12 w-full border border-[#3b483f] bg-[#020604] px-3 outline-none focus:border-[#a8e91d]"
                />
                <span className="mt-1 block text-xs font-normal text-[#929f96]">
                  Used for order updates.
                </span>
              </label>
              {delivery ? (
                <>
                  <label className="text-sm font-bold sm:col-span-2">
                    Delivery Address
                    <input
                      required
                      value={details.addressLine}
                      onChange={(event) =>
                        field("addressLine", event.target.value)
                      }
                      className="mt-2 h-12 w-full border border-[#3b483f] bg-[#020604] px-3 outline-none focus:border-[#a8e91d]"
                      placeholder="House number, street, complex"
                    />
                  </label>
                  <label className="text-sm font-bold">
                    City / Suburb
                    <input
                      required
                      value={details.suburb}
                      onChange={(event) => field("suburb", event.target.value)}
                      className="mt-2 h-12 w-full border border-[#3b483f] bg-[#020604] px-3 outline-none focus:border-[#a8e91d]"
                    />
                  </label>
                  <label className="text-sm font-bold">
                    City
                    <input
                      required
                      value={details.city}
                      onChange={(event) => field("city", event.target.value)}
                      className="mt-2 h-12 w-full border border-[#3b483f] bg-[#020604] px-3 outline-none focus:border-[#a8e91d]"
                    />
                  </label>
                  <label className="text-sm font-bold">
                    Province
                    <input
                      required
                      value={details.province}
                      onChange={(event) =>
                        field("province", event.target.value)
                      }
                      className="mt-2 h-12 w-full border border-[#3b483f] bg-[#020604] px-3 outline-none focus:border-[#a8e91d]"
                    />
                  </label>
                  <label className="text-sm font-bold">
                    Postal Code
                    <input
                      required
                      pattern="[0-9]{4}"
                      inputMode="numeric"
                      value={details.postalCode}
                      onChange={(event) =>
                        field("postalCode", event.target.value)
                      }
                      className="mt-2 h-12 w-full border border-[#3b483f] bg-[#020604] px-3 outline-none focus:border-[#a8e91d]"
                    />
                  </label>
                  <label className="text-sm font-bold sm:col-span-2">
                    Delivery Instructions (Optional)
                    <textarea
                      value={details.deliveryInstructions}
                      onChange={(event) =>
                        field("deliveryInstructions", event.target.value)
                      }
                      className="mt-2 min-h-24 w-full border border-[#3b483f] bg-[#020604] p-3 outline-none focus:border-[#a8e91d]"
                    />
                  </label>
                  <label className="flex items-center gap-3 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={details.saveAddress}
                      onChange={(event) =>
                        field("saveAddress", event.target.checked)
                      }
                      className="size-5 accent-[#a8e91d]"
                    />
                    Save this address for future checkout
                  </label>
                </>
              ) : null}
            </div>
            <button className="mt-6 h-13 w-full bg-[#a7e627] font-black text-[#081000]">
              Continue to Review
            </button>
          </form>
        ) : (
          <section className="border border-[#2e3a32] bg-[#08100b] p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-black">
                {delivery ? "Delivery details" : "Collection details"}
              </h2>
              <button
                onClick={() => setStep("details")}
                className="inline-flex items-center gap-2 border border-[#4b5a4e] px-3 py-2 text-sm font-bold"
              >
                <Pencil size={16} />
                Edit
              </button>
            </div>
            <dl className="mt-5 grid gap-4 text-sm">
              <div>
                <dt className="text-[#929f96]">Customer</dt>
                <dd className="mt-1 font-bold">
                  {details.firstName} {details.surname}
                </dd>
              </div>
              <div>
                <dt className="text-[#929f96]">Phone</dt>
                <dd className="mt-1 font-bold">{details.phoneNumber}</dd>
              </div>
              {delivery ? (
                <div>
                  <dt className="text-[#929f96]">Deliver to</dt>
                  <dd className="mt-1 flex items-start gap-2 font-bold">
                    <MapPin
                      size={17}
                      className="mt-0.5 shrink-0 text-[#a8e91d]"
                    />
                    {[
                      details.addressLine,
                      details.suburb,
                      details.city,
                      details.province,
                      details.postalCode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </dd>
                </div>
              ) : null}
            </dl>
            <fieldset className="mt-6 border-t border-[#2f3b33] pt-5">
              <legend className="font-black">Payment on fulfillment</legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label
                  className={`flex h-12 cursor-pointer items-center justify-center gap-2 border font-bold ${paymentMethod === "card" ? "border-[#a8e91d] bg-[#142208] text-[#b5ef3c]" : "border-[#3b483f]"}`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    checked={paymentMethod === "card"}
                    onChange={() => setPaymentMethod("card")}
                  />
                  <CreditCard size={18} />
                  Card
                </label>
                <label
                  className={`flex h-12 cursor-pointer items-center justify-center gap-2 border font-bold ${paymentMethod === "cash" ? "border-[#a8e91d] bg-[#142208] text-[#b5ef3c]" : "border-[#3b483f]"}`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    checked={paymentMethod === "cash"}
                    onChange={() => setPaymentMethod("cash")}
                  />
                  <WalletCards size={18} />
                  Cash
                </label>
              </div>
            </fieldset>
            <button
              disabled={placing}
              onClick={placeOrder}
              className="mt-6 h-13 w-full bg-[#a7e627] font-black text-[#081000] disabled:opacity-50"
            >
              {placing ? "Placing order..." : "Place Order"}
            </button>
          </section>
        )}

        <aside className="h-fit border border-[#2e3a32] bg-[#08100b] p-5">
          <div className="flex justify-between gap-3">
            <h2 className="text-xl font-black">Order Summary</h2>
            <span className="text-sm text-[#9ca79e]">
              {cart.itemCount} items
            </span>
          </div>
          <ul className="mt-4 divide-y divide-[#263229]">
            {cart.items.map((item) => (
              <li key={item.id} className="flex gap-3 py-3">
                <div className="relative size-14 shrink-0 bg-[#111812]">
                  {item.imageUrl ? (
                        <CustomerImage
                          src={item.imageUrl}
                          alt=""
                          sizes="56px"
                          className="object-contain p-1"
                        />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-bold">{item.name}</p>
                  <p className="mt-1 text-xs text-[#9da89f]">
                    {item.quantity} × {money.format(item.unitPrice)}
                  </p>
                </div>
                <strong className="text-sm text-[#a8e91d]">
                  {money.format(item.unitPrice * item.quantity)}
                </strong>
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid gap-3 border-t border-[#344138] pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#a2ada4]">Subtotal</dt>
              <dd>{money.format(cart.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#a2ada4]">
                {delivery ? "Delivery fee" : "Collection fee"}
              </dt>
              <dd>{money.format(fee)}</dd>
            </div>
            <div className="flex justify-between border-t border-[#344138] pt-4 text-lg font-black">
              <dt>Total</dt>
              <dd className="text-[#a8e91d]">{money.format(total)}</dd>
            </div>
          </dl>
          <p className="mt-5 flex items-start gap-2 border border-[#2f3d33] bg-[#0c150f] p-3 text-sm text-[#aeb8b0]">
            <LockKeyhole size={17} className="mt-0.5 shrink-0 text-[#a8e91d]" />
            Your information is used only to fulfill this order.
          </p>
        </aside>
      </div>
    </main>
  );
}
